# User Guide: SMS Blaster

## Introduction
SMS Blaster allows you to send bulk SMS messages to your contacts using your own Android phone as a gateway. This guide will help you set up and manage your SMS campaigns.

## 1. Getting Started
1.  **Sign Up**: Create an account on the SMS Blaster platform.
2.  **Dashboard**: Once logged in, you'll see your dashboard overview, including campaign stats and device status.

## 2. Managing Contacts
### Adding Contacts
- Navigate to **Contacts** > **Add Contact**.
- Enter the contact's name and phone number (including country code).
- Assign them to a group if needed.

### Contact Groups
- Use groups to organize your contacts (e.g., "VIP Customers", "Leads").
- Navigate to **Contact Groups** to create and manage your groups.

### Importing Contacts
- You can bulk import contacts using the **Import** feature (supports CSV format).

## 3. Connecting Your Android Device
To send messages, you must register at least one Android device.

### Native Device (Polling)
1.  Navigate to **Devices** > **Register Device**.
2.  Enter a name for your device.
3.  Select **Native** as the device type.
4.  After registration, you will receive a **Device ID** and **API Key**.
5.  Install the SMS Blaster Gateway app on your Android phone and enter these credentials.

### Mymobkit Device (Push)
1.  Install [Mymobkit](https://www.mymobkit.com/) on your Android device.
2.  Enable the HTTP API in Mymobkit settings.
3.  In SMS Blaster, navigate to **Devices** > **Register Device**.
4.  Select **Mymobkit** as the device type.
5.  Enter the **Gateway URL** provided by the Mymobkit app (e.g., `http://192.168.1.5:8080`).
6.  Ensure your phone is on the same network or has a public IP/port forwarding configured.

## 4. Creating SMS Campaigns
1.  Navigate to **Campaigns** > **Create Campaign**.
2.  **Name**: Give your campaign a descriptive name.
3.  **Message**: Compose your SMS message.
4.  **Target Audience**:
    - **All Contacts**: Sends to everyone in your database.
    - **Specific Group**: Sends to contacts in a selected group.
    - **Multiple Contacts**: Manually pick individual contacts.
5.  **Scheduling**:
    - **Draft**: Save for later.
    - **Scheduled**: Select a date and time for the campaign to start.
    - **Sending**: Start processing immediately (if time is in the past).
6.  **Recurrence**: (Optional) Set the campaign to repeat (e.g., daily).

## 5. Monitoring and Reports
- **Campaign Status**: Track whether your campaign is `Draft`, `Scheduled`, `Sending`, or `Completed`.
- **Message Logs**: View individual message delivery statuses (`Sent`, `Delivered`, `Failed`).
- **Failure Reasons**: If a message fails, the system will often provide a reason (e.g., "Device Offline").

## Tips for Success
- **Keep Devices Online**: Ensure your Android device has a stable internet connection and is not in "Sleep" mode.
- **Phone Battery**: Keep the gateway device plugged in during large campaigns.
- **SMS Limits**: Be aware of your mobile carrier's SMS limits to avoid getting your SIM blocked.
