const nodemailer = require('nodemailer');

// Create a more straightforward Gmail transporter with environment check
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // e.g., smtp.gmail.com
    port: 587, // or 465 for SSL
    secure: false, // true for 465, false for 587
    auth: {
      user: "uthreadofficial@gmail.com",    
      pass: "apckepgjsmpljuoh",
    }
});

// Skip email verification if SEND_EMAILS is false
const shouldSendEmails = process.env.SEND_EMAILS !== 'false';

// Check connection on startup
if (shouldSendEmails) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email server error:', error);
    } else {
      console.log('Email server is ready to send messages');
    }
  });
} else {
  console.log('Email sending is disabled by configuration. OTP codes will be logged to console instead.');
}

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP code
 */
const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // If emails are disabled, log the OTP for testing
  if (!shouldSendEmails) {
    console.log(`========================================`);
    console.log(`TEST MODE: Verification code for next user: ${otp}`);
    console.log(`========================================`);
  }
  
  return otp;
};

/**
 * Send OTP verification email
 * @param {string} to Recipient email address
 * @param {string} otp OTP code to send
 * @param {string} username Username of the user
 * @returns {Promise} Promise resolving to mail send info
 */
const sendVerificationEmail = async (to, otp, username) => {
  // Skip sending if emails are disabled
  if (!shouldSendEmails) {
    console.log(`[EMAILS DISABLED] Would send verification email to ${to} with code ${otp}`);
    return { messageId: 'test-mode', accepted: [to] };
  }
  
  try {
    // Create HTML email template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your UThread Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #6b55e8; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0;">Email Verification</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
          <h3>Hi ${username},</h3>
          
          <p>Thank you for signing up with UThread! To complete your registration, please verify your email address using the verification code below:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0;">
            <p style="margin-bottom: 0; color: #666;">Your verification code is:</p>
            <div style="font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #6b55e8; margin: 10px 0;">${otp}</div>
            <p style="margin-top: 5px; font-size: 14px; color: #666;">This code will expire in 15 minutes.</p>
          </div>
          
          <p>If you did not request this verification code, please ignore this email.</p>
          
          <p>Best regards,<br>The UThread Team</p>
        </div>
      </body>
      </html>
    `;

    // Email options
    const mailOptions = {
      from: `"UThread" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Verify Your UThread Account',
      html
    };

    // Send the email
    const result = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send welcome email after successful verification
 * @param {string} to Recipient email address
 * @param {string} username Username of the user
 * @returns {Promise} Promise resolving to mail send info
 */
const sendWelcomeEmail = async (to, username) => {
  // Skip sending if emails are disabled
  if (!shouldSendEmails) {
    console.log(`[EMAILS DISABLED] Would send welcome email to ${to}`);
    return { messageId: 'test-mode', accepted: [to] };
  }
  
  try {
    // Create HTML email template
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to UThread</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #6b55e8; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0;">Welcome to UThread!</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
          <h3>Hi ${username},</h3>
          
          <p>Thank you for verifying your email and joining the UThread community! Your account has been successfully activated.</p>
          
          <p>You can now sign in and start exploring UThread.</p>
          
          <p>Best regards,<br>The UThread Team</p>
        </div>
      </body>
      </html>
    `;

    // Email options
    const mailOptions = {
      from: `"UThread" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Welcome to UThread! Your Account is Active',
      html
    };

    // Send the email
    const result = await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${to}`);
    return result;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

module.exports = {
  generateOTP,
  sendVerificationEmail,
  sendWelcomeEmail
};