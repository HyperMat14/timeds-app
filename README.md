# TiMeds

TiMeds is an Expo / React Native prototype for helping people keep track of daily medication
times. It targets Android, iOS, and web and uses Expo SDK 58.

## Current features

### Home and dose schedule

- Shows the next scheduled dose and a live countdown.
- Starts with an example dose time of **8:00 AM**.
- Add daily times using 24-hour numeric input: for example, `8` for 8:00 AM, `1530` for
  3:30 PM, or `0815` for 8:15 AM.
- Rejects invalid times and duplicate times; dose times are displayed in 12-hour format.
- Lists scheduled times and lets you remove them.
- Shows an empty-state message when there are no times.
- The schedule is held in app memory only. It is not saved across app restarts.

### Dose alarm

- When the app is open at a scheduled time, shows an on-screen dose reminder and plays a soft,
  original tabletop-clock-style bell repeatedly.
- The alarm continues until **Dismiss alarm** is pressed. Dismissing acknowledges the alert only;
  it does not record that medication was taken.
- Audio is paused when the app goes to the background, respects the phone's silent-mode setting,
  and is not delivered as a background notification. The app must be open at the scheduled time
  for this in-app alarm to appear.
- **Test dose reminder** in Settings previews the bell and reminder screen without changing the
  schedule or confirming a dose.
- The bell sound is included at `assets/audio/clock-bell.wav`.

### Appearance and settings

- A **Dark mode** switch changes the app between light and dark color palettes. The preference is
  saved on the device; before a preference is chosen, the app follows the system appearance.
- **Notification type** explains the current sound, vibration, and on-screen alert behavior. It
  does not currently configure phone notification settings; vibration is not enabled.
- **Reset app** restores the example 8:00 AM schedule, clears any open reminder and unsaved form
  input, and closes Settings. It does not reset the saved appearance preference.
- The dispenser indicator is a simulated disconnected status. Bluetooth connectivity is not
  implemented.

### Explore tab

The starter Explore screen contains collapsible project notes about routing, supported platforms,
images, color schemes, and animations, plus a link to Expo documentation.

## Not implemented yet

- Medication names, instructions, or a taken-dose history.
- Saving dose schedules between launches.
- Background or closed-app reminders, scheduled notifications, or custom notification sounds.
- Bluetooth connection to a medication dispenser.
- Configurable vibration or notification alert settings.

The app is a reminder prototype, not a medical device. A reminder dismissal is not proof that a
dose was taken.

## Run locally

Install dependencies and start the Expo development server:

```sh
npm install
npx expo start
```

Use the Expo Go client to open the project on a compatible phone, or start a platform target:

```sh
npx expo start --android
npx expo start --ios
npx expo start --web
```
