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
    
