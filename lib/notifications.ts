import nodemailer from "nodemailer";
import twilio from "twilio";

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends driver credentials to their email address
 */
export async function sendDriverRegistrationEmail(email: string, name: string, employeeId: string, passwordText: string) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = "Welcome to Smart Force Taxi - Your Driver Account Details";
  const text = `Hello ${name},

Welcome to Smart Force Taxi! Your driver account has been registered successfully.

Here are your account credentials to log in to the Driver Portal:
- Portal URL: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login
- Username (Email): ${email}
- Password: ${passwordText}
- Employee ID: ${employeeId}

Please keep these credentials safe and change your password after logging in.

Best regards,
Smart Force Taxi Operations Team`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #f59e0b;">Welcome to Smart Force Taxi, ${name}!</h2>
    <p>Your driver account has been created successfully. You can now access your control portal.</p>
    <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #27272a;">Your Credentials</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #71717a;">Username (Email):</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 14px;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #71717a;">Password:</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 14px; font-weight: bold;">${passwordText}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #71717a;">Employee ID:</td>
          <td style="padding: 6px 0; font-family: monospace; font-size: 14px;">${employeeId}</td>
        </tr>
      </table>
    </div>
    <p>Please log in at <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login" style="color: #d97706; text-decoration: none; font-weight: bold;">Driver Portal Login</a>.</p>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Driver registration email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send driver registration email:", error);
    return { error };
  }
}

/**
 * Triggers a WhatsApp message to the driver's phone containing their credentials
 */
export async function sendDriverRegistrationWhatsApp(phone: string, name: string, email: string, passwordText: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_FROM_WHATSAPP || "whatsapp:+14155238886";

  if (!accountSid || !authToken || accountSid.includes("ACXX") || authToken.includes("your_auth_")) {
    console.warn("Twilio credentials are not configured or are placeholder values. Skipping WhatsApp message.");
    return { error: "Twilio credentials not configured" };
  }

  try {
    const client = twilio(accountSid, authToken);

    // Format phone number to follow the 'whatsapp:+[country_code][number]' syntax
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("whatsapp:")) {
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = `+${formattedPhone}`;
      }
      formattedPhone = `whatsapp:${formattedPhone}`;
    }

    const messageText = `Hello ${name}, welcome to Smart Force Taxi!

Your driver account has been created.
Username (Email): ${email}
Password: ${passwordText}

Log in at: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`;

    const res = await client.messages.create({
      body: messageText,
      from: fromWhatsApp,
      to: formattedPhone,
    });

    console.log(`Driver registration WhatsApp sent successfully to: ${formattedPhone}, SID: ${res.sid}`);
    return { success: true, sid: res.sid };
  } catch (error) {
    console.error("Failed to send driver registration WhatsApp:", error);
    return { error };
  }
}

/**
 * Sends a booking cancellation email to the affected driver
 */
export async function sendBookingCancellationEmail(
  email: string,
  name: string,
  tripNumber: string,
  vehicleName: string,
  startTime: Date,
  endTime: Date
) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = `Booking Cancelled: ${tripNumber}`;
  const text = `Hello ${name},

We would like to inform you that your booking for vehicle ${vehicleName} (Trip Reference: ${tripNumber}) scheduled from ${new Date(startTime).toLocaleString()} to ${new Date(endTime).toLocaleString()} has been cancelled by the admin.

The vehicle is now released and available for booking by other drivers.

If you have any questions, please contact the administrator.

Best regards,
Smart Force Taxi Operations Team`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #dc2626;">Booking Cancellation Notice</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your scheduled vehicle booking has been cancelled by the administrator. Please find the details below:</p>
    <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fee2e2;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #7f1d1d;">Trip Reference:</td>
          <td style="padding: 6px 0; font-family: monospace;">${tripNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #7f1d1d;">Vehicle:</td>
          <td>${vehicleName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #7f1d1d;">Start Time:</td>
          <td>${new Date(startTime).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #7f1d1d;">End Time:</td>
          <td>${new Date(endTime).toLocaleString()}</td>
        </tr>
      </table>
    </div>
    <p>The vehicle has been released and is now available for other bookings.</p>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Booking cancellation email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send booking cancellation email:", error);
    return { error };
  }
}

/**
 * Sends a booking confirmation email to the driver
 */
export async function sendBookingConfirmationEmail(
  email: string,
  name: string,
  vehicleName: string,
  startTime: Date,
  endTime: Date,
  durationText: string
) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = "Booking Confirmation - Smart Force Taxi";
  
  const bookingDate = new Date(startTime).toLocaleDateString();
  const startStr = new Date(startTime).toLocaleString();
  const endStr = new Date(endTime).toLocaleString();

  const text = `Hello ${name},

Your vehicle booking has been confirmed.

Here are the details:
- Driver Name: ${name}
- Vehicle: ${vehicleName}
- Booking Date: ${bookingDate}
- Start Time: ${startStr}
- End Time: ${endStr}
- Duration: ${durationText}

Best regards,
Smart Force Taxi Operations Team`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #10b981; margin-top: 0;">Booking Confirmation</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your vehicle booking has been successfully confirmed. Please find the details below:</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dcfce7;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d; width: 120px;">Driver Name:</td>
          <td style="padding: 6px 0;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Vehicle:</td>
          <td style="padding: 6px 0;">${vehicleName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Booking Date:</td>
          <td style="padding: 6px 0;">${bookingDate}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Start Time:</td>
          <td style="padding: 6px 0;">${startStr}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">End Time:</td>
          <td style="padding: 6px 0;">${endStr}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Duration:</td>
          <td style="padding: 6px 0; font-weight: bold;">${durationText}</td>
        </tr>
      </table>
    </div>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Booking confirmation email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send booking confirmation email:", error);
    return { error };
  }
}

/**
 * Sends a car availability broadcast email to all drivers
 */
export async function sendCarAvailabilityBroadcastEmail(
  drivers: { email: string; name: string }[],
  vehicleName: string,
  vehicleNumber: string
) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = `Vehicle Available for Booking: ${vehicleName}`;

  for (const driver of drivers) {
    if (!driver.email) continue;

    const text = `Hello ${driver.name},

Good news! The vehicle ${vehicleName} (Plate Number: ${vehicleNumber}) has become available for booking again.

If you need this vehicle for your shift, please log in to the Driver Portal and book your slot.

Best regards,
Smart Force Taxi Operations Team`;

    const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
      <h2 style="color: #10b981; margin-top: 0;">Vehicle Available for Booking</h2>
      <p>Hello <strong>${driver.name}</strong>,</p>
      <p>Please be informed that a vehicle has become available again for booking:</p>
      <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dcfce7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #14532d; width: 120px;">Vehicle:</td>
            <td style="padding: 6px 0;">${vehicleName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Plate Number:</td>
            <td style="padding: 6px 0; font-family: monospace;">${vehicleNumber}</td>
          </tr>
        </table>
      </div>
      <p>You can now book this vehicle from your Driver Portal.</p>
      <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
        This is an automated operational message. Please do not reply directly to this email.
      </p>
    </div>`;

    try {
      await transporter.sendMail({
        from,
        to: driver.email,
        subject,
        text,
        html,
      });
      console.log(`Car availability broadcast email sent to: ${driver.email}`);
    } catch (error) {
      console.error(`Failed to send car availability broadcast email to ${driver.email}:`, error);
    }
  }
}

/**
 * Sends a vehicle reassignment notification email to the previous driver
 */
export async function sendVehicleReassignmentEmail(
  email: string,
  name: string,
  vehicleName: string,
  vehicleNumber: string
) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = `Vehicle Reassigned: ${vehicleName}`;
  const text = `Hello ${name},

We are writing to inform you that the vehicle ${vehicleName} (Plate Number: ${vehicleNumber}) previously assigned to you has been permanently reassigned to another driver.

Consequently, this vehicle has been removed from your permanent vehicle allocation.

If you have any questions, please contact the administrator.

Best regards,
Smart Force Taxi Operations Team`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #ea580c;">Vehicle Reassignment Notice</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We are writing to inform you that the vehicle previously assigned to you has been permanently reassigned to another driver:</p>
    <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffedd5;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #c2410c; width: 120px;">Vehicle:</td>
          <td style="padding: 6px 0;">${vehicleName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #c2410c;">Plate Number:</td>
          <td style="padding: 6px 0; font-family: monospace;">${vehicleNumber}</td>
        </tr>
      </table>
    </div>
    <p>This vehicle is now permanently assigned to another driver and has been removed from your permanent vehicle allocation.</p>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Vehicle reassignment email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send vehicle reassignment email:", error);
    return { error };
  }
}

/**
 * Sends a vehicle assignment confirmation email to the newly assigned driver
 */
export async function sendVehicleAssignmentEmail(
  email: string,
  name: string,
  vehicleName: string,
  vehicleNumber: string
) {
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = `Vehicle Allocated: ${vehicleName}`;
  const text = `Hello ${name},

We are pleased to inform you that the vehicle ${vehicleName} (Plate Number: ${vehicleNumber}) has been permanently allocated to you.

You can now use this vehicle for your shifts and bookings.

Best regards,
Smart Force Taxi Operations Team`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #10b981; margin-top: 0;">Vehicle Allocation Notice</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We are pleased to inform you that the vehicle has been permanently allocated to you:</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dcfce7;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d; width: 120px;">Vehicle:</td>
          <td style="padding: 6px 0;">${vehicleName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #14532d;">Plate Number:</td>
          <td style="padding: 6px 0; font-family: monospace;">${vehicleNumber}</td>
        </tr>
      </table>
    </div>
    <p>This vehicle is now permanently assigned to you and is ready for your shifts.</p>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Vehicle assignment email sent successfully to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send vehicle assignment email:", error);
    return { error };
  }
}

/**
 * Sends a daily email to all drivers showing the available vehicles and slots for tomorrow
 */
export async function sendDailyAvailableVehiclesEmail() {
  const { db } = await import("@/lib/db");
  
  // Calculate tomorrow's range in local time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayStart = new Date(tomorrow);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(tomorrow);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Fetch all active vehicles (status is not MAINTENANCE and not OFFLINE)
  const vehicles = await db.vehicle.findMany({
    where: {
      status: {
        notIn: ["MAINTENANCE", "OFFLINE"],
      },
    },
  });

  const availableList: { vehicleName: string; slots: string[] }[] = [];

  for (const vehicle of vehicles) {
    // Fetch bookings for tomorrow
    const trips = await db.trip.findMany({
      where: {
        vehicleId: vehicle.id,
        status: {
          not: "CANCELLED",
        },
        startTime: {
          lt: dayEnd,
        },
        endTime: {
          gt: dayStart,
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Clamp bookings to tomorrow's boundaries
    const bookings = trips.map((t) => {
      const bStart = new Date(t.startTime);
      const bEnd = new Date(t.endTime);
      return {
        start: bStart < dayStart ? dayStart : bStart,
        end: bEnd > dayEnd ? dayEnd : bEnd,
      };
    });

    // Calculate free slots
    const freeSlots: { start: Date; end: Date }[] = [];
    let currentMarker = dayStart;

    bookings.forEach((b) => {
      if (b.start.getTime() > currentMarker.getTime()) {
        freeSlots.push({
          start: new Date(currentMarker),
          end: new Date(b.start),
        });
      }
      if (b.end.getTime() > currentMarker.getTime()) {
        currentMarker = b.end;
      }
    });

    if (currentMarker.getTime() < dayEnd.getTime()) {
      freeSlots.push({
        start: new Date(currentMarker),
        end: new Date(dayEnd),
      });
    }

    if (freeSlots.length > 0) {
      const formatTime12h = (date: Date) => {
        let str = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
        // Clean up leading zero if necessary, e.g. "08:00 AM" to "8:00 AM"
        if (str.startsWith("0")) {
          str = str.substring(1);
        }
        return str;
      };
      
      const slotsText = freeSlots.map(
        (slot) => `${formatTime12h(slot.start)} – ${formatTime12h(slot.end)} Available`
      );
      
      availableList.push({
        vehicleName: `${vehicle.brand} ${vehicle.name} (${vehicle.vehicleNumber})`,
        slots: slotsText,
      });
    }
  }

  // 2. Fetch all DRIVER users
  const drivers = await db.user.findMany({
    where: {
      role: "DRIVER",
    },
  });

  if (drivers.length === 0) {
    console.log("No drivers registered to send daily available vehicles email.");
    return { success: true, message: "No drivers registered." };
  }

  if (availableList.length === 0) {
    console.log("No vehicles available for tomorrow to broadcast.");
    return { success: true, message: "No vehicles available tomorrow." };
  }

  // 3. Format the email content
  const tomorrowFormatted = dayStart.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const from = process.env.SMTP_FROM || `"Smart Force Taxi" <noreply@smartforcetaxi.com>`;
  const subject = `Available Vehicles & Slots for Tomorrow: ${tomorrowFormatted}`;

  // Plain text version
  let text = `Hello,\n\nHere are the vehicles and time slots available for booking tomorrow, ${tomorrowFormatted}:\n\n`;
  availableList.forEach((item) => {
    text += `* ${item.vehicleName}\n`;
    item.slots.forEach((slot) => {
      text += `  - ${slot}\n`;
    });
    text += `\n`;
  });
  text += `Best regards,\nSmart Force Taxi Operations Team`;

  // HTML version
  let html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
    <h2 style="color: #f59e0b; margin-top: 0;">Available Vehicles for Tomorrow</h2>
    <p>Hello,</p>
    <p>Here is the schedule of vehicles and time slots available for booking tomorrow, <strong>${tomorrowFormatted}</strong>:</p>
    <div style="background-color: #fcfbf7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fef3c7;">
      <ul style="padding-left: 20px; margin: 0;">`;
      
  availableList.forEach((item) => {
    html += `<li style="margin-bottom: 12px; font-weight: bold; color: #27272a;">
      ${item.vehicleName}
      <ul style="padding-left: 20px; font-weight: normal; margin-top: 4px; color: #4b5563;">`;
    item.slots.forEach((slot) => {
      html += `<li style="margin-bottom: 2px;">${slot}</li>`;
    });
    html += `</ul></li>`;
  });
  
  html += `</ul>
    </div>
    <p>If you need to book any of these slots, please log in to the <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login" style="color: #d97706; text-decoration: none; font-weight: bold;">Driver Portal</a> and reserve your slot.</p>
    <p style="font-size: 12px; color: #a1a1aa; margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 15px;">
      This is an automated operational message. Please do not reply directly to this email.
    </p>
  </div>`;

  // 4. Send emails to all drivers
  let successCount = 0;
  let failCount = 0;

  for (const driver of drivers) {
    if (!driver.email) continue;
    try {
      await transporter.sendMail({
        from,
        to: driver.email,
        subject,
        text,
        html,
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to send daily available vehicles email to ${driver.email}:`, err);
      failCount++;
    }
  }

  console.log(`Daily available vehicles email broadcast completed. Success: ${successCount}, Failed: ${failCount}`);
  return { success: true, sentCount: successCount, failedCount: failCount };
}
