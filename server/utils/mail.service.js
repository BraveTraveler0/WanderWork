const nodemailer = require("nodemailer");
const smtpTransport = require('nodemailer-smtp-transport');

const AWS_MAIL_DRIVER = process.env.AWS_MAIL_DRIVER;
const AWS_MAIL_HOST = process.env.AWS_MAIL_HOST;
const AWS_MAIL_PORT = process.env.AWS_MAIL_PORT;
const AWS_MAIL_USERNAME = process.env.AWS_MAIL_USERNAME;
const AWS_MAIL_PASSWORD = process.env.AWS_MAIL_PASSWORD;
const AWS_MAIL_ENCRYPTION = process.env.AWS_MAIL_ENCRYPTION;
const AWS_MAIL_FROM_ADDRESS = process.env.AWS_MAIL_FROM_ADDRESS;
const GMAIL_USERNAME = process.env.GMAIL_USERNAME;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;
const GMAIL_FROM = process.env.GMAIL_FROM;

async function sendEmail(data) {
    let { to, subject, text, type } = data;
    if (type === "ses") {
        const transporter = nodemailer.createTransport({
            host: AWS_MAIL_HOST,
            port: AWS_MAIL_PORT,
            auth: {
                user: AWS_MAIL_USERNAME,
                pass: AWS_MAIL_PASSWORD
            }
        });
        const mailOptions = {
            from: AWS_MAIL_FROM_ADDRESS,
            to: to,
            subject: subject,
            text: text,
        };
        try {
            await transporter.sendMail(mailOptions);
            console.log("SES email sent successfully!");
            return true;
        } catch (error) {
            console.error("SES error sending email:", error);
            return false;
        }
    } else {
        const transporter = nodemailer.createTransport(smtpTransport({
            service: 'Gmail',
            auth: {
                type: 'OAuth2',
                user: GMAIL_USERNAME,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                accessToken: process.env.GMAIL_ACCESS_TOKEN,
            }
        }));
        const mailOptions = {
            from: GMAIL_FROM,
            to: to,
            subject: subject,
            text: text,
        };
        try {
            await transporter.sendMail(mailOptions);
            console.log("Gmail sent successfully!");
            return true;
        } catch (error) {
            console.error("Error sending Gmail:", error);
            return false;
        }
    }
}

module.exports = sendEmail;