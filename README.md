Minport
=======

![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg) ![Version](https://img.shields.io/badge/version-1.1.0-blue.svg) ![Platform](https://img.shields.io/badge/platform-Electron-47848F.svg)

Hand-tracked, voice-driven desktop widgets in **Electron** with a **Widget Gallery**, **custom URL widgets**, and a **brick game**.

* * *

What's New in v1.1
------------------

*   **Widget Gallery** (☰ Widgets): Add and remove widgets from a central gallery interface. "Remove" only hides widgets—you can re-add them from the gallery anytime.
*   **Built-in widgets**: Calendar, Weather, Yahoo News, Brick Game
*   **Web embeds (iframe)**: YouTube, Facebook, Twitter, LinkedIn, Google Search, Robinhood
*   **Custom URL widget**: Give it a title + URL and it becomes a draggable card on your desktop

> **Note:** Many sites block embedding via CSP/X-Frame-Options. If blocked, Minport shows an "Open in Browser" button.

* * *

To Use
------

To clone and run this repository, you'll need [Git](https://git-scm.com) and [Node.js](https://nodejs.org/en/download/) (which comes with [npm](http://npmjs.com)) installed on your computer.

From your command line:

**1. Clone this repository**

```bash
git clone https://github.com/your-username/minport.git
cd minport
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the application**

```bash
npm start
```

Note: If you're using Linux Bash for Windows, [see this guide](https://www.howtogeek.com/261575/how-to-run-graphical-linux-desktop-applications-from-windows-10s-bash-shell/) or run `node` and `electron` from a regular command prompt / PowerShell.

* * *

Features
--------

### Widget Gallery

*   Access via **☰ Widgets** button
*   Add/remove widgets on demand
*   Removed widgets can be re-added anytime

### Built-in Widgets

*   **Calendar** - View your schedule
*   **Weather** - Check weather updates
*   **Yahoo News** - Read latest news
*   **Brick Game** - Play the classic brick-breaker game

### Web Embeds

Minport supports iframe embeds for:

*   YouTube
*   Facebook
*   Twitter
*   LinkedIn
*   Google Search
*   Robinhood

### Custom URL Widget

*   Create your own widget with any URL
*   Provide a title and URL
*   Widget becomes a card on your desktop

### Hand Tracking & Voice Control

*   Hand-tracked interface for gesture-based control
*   Voice-driven commands for hands-free operation

* * *

Widget Compatibility
--------------------

Many sites block iframe embedding due to CSP/X-Frame-Options security policies. When a site cannot be embedded, Minport displays an "Open in Browser" button to view the content externally.

* * *

Acknowledgments
---------------

*   [Electron](https://www.electronjs.org/)
*   [Node.js](https://nodejs.org/)
