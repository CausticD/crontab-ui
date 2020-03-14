Crontab UI
==========

Forked from: https://github.com/alseambusher/crontab-ui

Disclaimer:

I am no JavaScript / NodeJS developer. I had a need for something like this and thought I would see if I could fix some issues with alseambusher's original. Just playing around, making changes that suit me and learning whilst at it!

Features:
- NEW: Log Rotation. This integrates the 'logrotate' command with these features:
    - Additions to the job UI to switch on per job log rotation.
    - Control frequency, compression and log count.
    - If any jobs use logrotate, then an extra job is (behind the scenes) added to call logrotate hourly. (Not shown in the UI.)
    - Output from logrotate is output to a log (./logrotate/logrotate.log), but not appended. No UI access to this file.

- IMPROVED: More control over logging.
    - You can now choose what output from the command gets logged, either none, stdout, stderr or both.
    - All output from a job goes to one log file and is appended.
    - Each line of that file starts with a timestamp.

My Changes:

- When autosave is enabled, don't show the Save and Load buttons in the UI. When this mode is on, it seems a little pointless and rather confusing to show them. (THIS HAS ISSUES. I am rethinking this change.)

- Tidy up the name of the backups.
    - The files were (in my case) called 'backup Fri Dec 21 2018 13:00:53 GMT+0000 (Greenwich Mean Time).db'
    - Now they are 'backup 2018-05-16 09:50:02.db'
    - The UI removes the 'backup' and '.db' parts to just show '2018-05-16 09:50:02' etc.
    - It still shows the newest on top, but it doesn't have to sort them.
    
- Added button to delete log file of a job. Handy since they can get huge now they can capture all output.

- Changed GitHub link in UI to be this fork.

My Breaking Changes:

- I have broken/removed the ability to email logs! I don't have a way of testing this, so I have commented it out.

Usage:

- To start the web server:
        'HOST=0.0.0.0 PORT=9000 npm start'
        
Uses:

Basically, anytime you want to use Cron but would rather have a UI to control things, see logs etc. 

- Adding an auto updater to Pi-Hole (https://pi-hole.net/) since it doesn't have one by default.
- Automating parts of a docker setup.

Setup / Troubleshooting:

- The first issue I had was that the UI seemed fine until I tried saving and then it gave me a error. This was caused by crontab not being installed! Run 'crontab -l' (this is the command that the UI uses internally). If this gives an error, tackle that first. If it spits out nothing, that is okay as it might just mean you don't have any cron jobs.

- If a command that normally works isn't, very often it is done to differences in path. You can set this manually, or, use the 'whereis' command to get the full path and then use that. Try setting 'PATH=/sbin:/bin:/usr/sbin:/usr/bin' which should cover most and then whereis for anything special.

- To test everything is set up, try adding a temporary job of just 'logrotate'. If that gives an error then the log rotation options will not work and it probably means your PATH isn't set correctly. See above for suggestion. To test the very basics, 'pwd' and 'whoami' can be useful.

- There are plenty of other reasons a job can work manually, but not as part of cron. Try setting 'SHELL=/bin/bash' to see if this fixes it.

Gotchas:

- Running a task through the Web UI doesn't output to the log, but to the 'npm start'.

Install node on Pi-Hole:

1) Go to: https://nodejs.org/en/download/
2) Select LTS and copy the link to the Armv7 Linux Binary. eg. https://nodejs.org/dist/v12.16.1/node-v12.16.1-linux-armv7l.tar.xz
3) On the Pi, type 'wget https://nodejs.org/dist/v12.16.1/node-v12.16.1-linux-armv7l.tar.xz'
4) Follow instructions from here: https://github.com/nodejs/help/wiki/Installation
4A) 'sudo mkdir -p /usr/local/lib/nodejs'
4B) 'sudo tar -xJvf node-v12.16.1-linux-armv7l.tar.xz -C /usr/local/lib/nodejs'
4C) 'nano ~/.profile'
4D) Add to the bottom
	# add NodeJS
	PATH="/usr/local/lib/nodejs/node-v12.16.1-linux-armv7l/bin:$PATH"
4E) Reload to get changes: '. ~/.profile'
4F) Test using:
	'node -v' (you should get v12.16.1)
	'npm version' (you should get a dozen or so lines of JSON)
	'npx -v' (you should get 6.13.4)
        
Install this repo:

1) Pull my repo: 'git clone https://github.com/CausticD/crontab-ui.git'
2) Change to the dir you just pulled into: 'cd crontab-ui'
3) Install: 'npm install'
4) Run with: 'HOST=0.0.0.0 PORT=9000 npm start'

Adding PM2 into the mix to allow easy running of a background task:

1) Install PM2 with 'npm install pm2 -g'
2) Run using 'pm2 start', there is a config file for it to find that has the env variables.
