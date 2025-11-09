const cron = require('node-cron');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const db = require('./db-loader');

// Email configuration from environment variables
const EMAIL_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD,
  to: process.env.BACKUP_EMAIL_TO
};

// Create email transporter
function createTransporter() {
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('⚠️  Email not configured - automatic backups disabled');
    return null;
  }

  return nodemailer.createTransporter({
    service: EMAIL_CONFIG.service,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass
    }
  });
}

// Generate complete backup Excel file
async function generateBackupFile() {
  const workbook = new ExcelJS.Workbook();

  // Export Players
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM players ORDER BY last_name, first_name', [], (err, players) => {
      if (err) return reject(err);

      const sheet = workbook.addWorksheet('Joueurs');
      sheet.columns = [
        { header: 'Licence', key: 'licence', width: 15 },
        { header: 'Prénom', key: 'first_name', width: 20 },
        { header: 'Nom', key: 'last_name', width: 20 },
        { header: 'Club', key: 'club', width: 30 },
        { header: 'Rang Libre', key: 'rank_libre', width: 15 },
        { header: 'Rang Cadre', key: 'rank_cadre', width: 15 },
        { header: 'Rang Bande', key: 'rank_bande', width: 15 },
        { header: 'Rang 3 Bandes', key: 'rank_3bandes', width: 15 },
        { header: 'Actif', key: 'is_active', width: 10 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } };

      players.forEach(p => {
        sheet.addRow({ ...p, is_active: p.is_active ? 'Oui' : 'Non' });
      });

      resolve();
    });
  });

  // Export Tournaments
  await new Promise((resolve, reject) => {
    db.all(`
      SELECT t.*, c.display_name as category
      FROM tournaments t
      JOIN categories c ON t.category_id = c.id
      ORDER BY t.season DESC, t.tournament_number
    `, [], (err, tournaments) => {
      if (err) return reject(err);

      const sheet = workbook.addWorksheet('Tournois');
      sheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Catégorie', key: 'category', width: 30 },
        { header: 'Saison', key: 'season', width: 15 },
        { header: 'Numéro', key: 'tournament_number', width: 10 },
        { header: 'Date Import', key: 'import_date', width: 20 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } };

      tournaments.forEach(t => sheet.addRow(t));
      resolve();
    });
  });

  // Export Tournament Results
  await new Promise((resolve, reject) => {
    db.all(`
      SELECT tr.*, t.season, c.display_name as category, t.tournament_number
      FROM tournament_results tr
      JOIN tournaments t ON tr.tournament_id = t.id
      JOIN categories c ON t.category_id = c.id
      ORDER BY t.season DESC, tr.match_points DESC
    `, [], (err, results) => {
      if (err) return reject(err);

      const sheet = workbook.addWorksheet('Résultats');
      sheet.columns = [
        { header: 'Saison', key: 'season', width: 15 },
        { header: 'Catégorie', key: 'category', width: 30 },
        { header: 'Tournoi', key: 'tournament_number', width: 10 },
        { header: 'Licence', key: 'licence', width: 15 },
        { header: 'Joueur', key: 'player_name', width: 25 },
        { header: 'Points Match', key: 'match_points', width: 15 },
        { header: 'Moyenne', key: 'moyenne', width: 12 },
        { header: 'Série', key: 'serie', width: 10 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } };

      results.forEach(r => sheet.addRow(r));
      resolve();
    });
  });

  // Export Rankings
  await new Promise((resolve, reject) => {
    db.all(`
      SELECT r.*, c.display_name as category, p.first_name, p.last_name, p.club
      FROM rankings r
      JOIN categories c ON r.category_id = c.id
      JOIN players p ON r.licence = p.licence
      ORDER BY r.season DESC, r.rank_position
    `, [], (err, rankings) => {
      if (err) return reject(err);

      const sheet = workbook.addWorksheet('Classements');
      sheet.columns = [
        { header: 'Saison', key: 'season', width: 15 },
        { header: 'Catégorie', key: 'category', width: 30 },
        { header: 'Position', key: 'rank_position', width: 10 },
        { header: 'Licence', key: 'licence', width: 15 },
        { header: 'Prénom', key: 'first_name', width: 20 },
        { header: 'Nom', key: 'last_name', width: 20 },
        { header: 'Club', key: 'club', width: 30 },
        { header: 'Total Points', key: 'total_match_points', width: 12 },
        { header: 'Moyenne', key: 'avg_moyenne', width: 12 },
        { header: 'Meilleure Série', key: 'best_serie', width: 15 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } };

      rankings.forEach(r => sheet.addRow(r));
      resolve();
    });
  });

  return workbook;
}

// Send backup email
async function sendBackupEmail() {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('⚠️  Cannot send backup email - email not configured');
    return;
  }

  try {
    console.log('📧 Generating weekly backup...');

    const workbook = await generateBackupFile();
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `Backup_Complet_${new Date().toISOString().split('T')[0]}.xlsx`;

    const mailOptions = {
      from: EMAIL_CONFIG.user,
      to: EMAIL_CONFIG.to || EMAIL_CONFIG.user,
      subject: `[Billard Ranking] Sauvegarde automatique du ${new Date().toLocaleDateString('fr-FR')}`,
      text: `Bonjour,

Voici votre sauvegarde hebdomadaire automatique de la base de données Billard Ranking.

Cette sauvegarde contient :
- Liste complète des joueurs
- Tous les tournois
- Résultats de tous les tournois
- Classements actuels

Fichier : ${filename}
Date : ${new Date().toLocaleString('fr-FR')}

Ce backup est généré automatiquement tous les dimanches à minuit.

Cordialement,
Système de Ranking Billard`,
      attachments: [
        {
          filename: filename,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Weekly backup email sent successfully');

  } catch (error) {
    console.error('❌ Error sending backup email:', error);
  }
}

// Schedule backup every Sunday at midnight
function startScheduledBackups() {
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('⚠️  Scheduled backups not started - email configuration missing');
    console.log('   Set EMAIL_USER, EMAIL_PASSWORD, and BACKUP_EMAIL_TO environment variables');
    return;
  }

  // Cron schedule: '0 0 * * 0' = Every Sunday at 00:00 (midnight)
  cron.schedule('0 0 * * 0', () => {
    console.log('⏰ Running scheduled weekly backup...');
    sendBackupEmail();
  }, {
    timezone: "Europe/Paris"
  });

  console.log('✅ Scheduled backups enabled - Running every Sunday at midnight (Paris time)');
  console.log(`   Backup emails will be sent to: ${EMAIL_CONFIG.to || EMAIL_CONFIG.user}`);
}

// Manual trigger for testing
async function triggerManualBackup() {
  console.log('🔧 Manual backup triggered');
  await sendBackupEmail();
}

module.exports = {
  startScheduledBackups,
  triggerManualBackup
};
