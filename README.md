Crontab UI
==========

Forked from: https://github.com/alseambusher/crontab-ui

My Changes:

- When autosave is enabled, don't show the Save and Load buttons in the UI. When this mode is on, it seems a little pointless and rather confusing to show them.

- Tidy up the name of the backups.
    - The files were (in my case) called 'backup Fri Dec 21 2018 13:00:53 GMT+0000 (Greenwich Mean Time).db'
    - Now they are 'backup 2018-05-16 09:50:02.db'
    - The UI removes the 'backup' and '.db' parts to just show '2018-05-16 09:50:02' etc.
    - It still shows the newest on top, but it doesn't have to sort them.
    
- Changed GitHub link in UI to be this fork.

Troubleshooting:

- The first issue I had was that the UI seemed fine until I tried saving and then it gave me a error. This was caused by crontab not being installed! Run 'crontab -l' (this is the command that the UI uses internally). If this gives an error, tackle that first. If it spits out nothing, that is okay as it might just mean you don't have any cron jobs.
