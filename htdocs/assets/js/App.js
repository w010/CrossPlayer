/**
 * App boot
 * wolo.pl '.' studio
 * 2022
 */


let App = {

    /**
     * Developer/advanced mode (deactivate / hide some elements / validations / checks / code parts, to make work easier) 
     * (bool)
     */
    DEV: false,
    /**
     * Debug level. Higher = display more tech info and more console.log spam 
     * (int)
     */
    DEBUG: 0,
    /**
     * Allows to test some feature alone/fullpage - disables running the actual App!
     */
    TEST_EXPLICIT: false,




    /**
     * Developer helper
     * @private
     */
    _lowLevel: () => {
            // usually the line below SHOULD NOT BE COMMENTED OUT!
        return;


        // Hide / remove some dom elements for work (like navbar, or other sticky or big elements which disturbs work by covering everything on big zoom... etc)
        Utility.replaceDomElements({
            '.navbar': '',
            //'#operate-panel': '',
        });
        // App.TEST_EXPLICIT = true;
        App.DEV = true;


        Xplayer.synchronizationMonitor({refresh: 500});
        // VolumeControls.runTester('VolumeRotaryPot');     App.TEST_EXPLICIT = true;
        // VolumeControls.runTester('Crossfader');          App.TEST_EXPLICIT = true;
    },



    /**
     * System check, prepare env, etc. 
     */
    warmUpEnvironment: () => {
        if (document.body.classList.contains('dev-mode'))  {
            App.DEV = true;
        }

        // Build custom console (dedicated for standalone mode)

        QConsole.configure({dev: App.DEV /*startState: 'expanded'*/});
        QConsole.cliRegisterCommands(Xplayer.cliCommands());    // or call after app config initialize?
        QConsole.available = true;
        $('#console').QC_makeItAConsole();
    },


    /**
     * Last preparations before App boot
     */
    preBoot: () => {
        App._lowLevel();
    },

};







// Run directly
(() => {
    'use strict'


    // Prepare some stuff on the very beginning

    App.warmUpEnvironment();





    // Check node.js availability (standalone mode)

    XplayerNode.tryToInit();





    // Last things before we go

    App.preBoot();

    if (App.TEST_EXPLICIT)  {
        return Xplayer.writeToConsole('Explicit feature test mode! App boot disabled', null, 'warning');
    }



    // Start the App

    let boot = (incomingConfig) => {
        Xplayer.configure(incomingConfig);
        Xplayer.initialize();
    }



    // if node has status: operating, it means we're in the app/standalone mode.
    // in such case, read configuration data using node filesystem tools and boot using it when ready.
    if (XplayerNode.operating)  {
        XplayerNode.readConfigData((readConfig) => {
            readConfig.console_show = true;
            readConfig.data_dir = readConfig.data_dir.replace('/^\.\/data/', './app/data/');
            Xplayer.writeToConsole(readConfig.data_dir);

            boot(readConfig);
        });
    }
    // otherwise - standard run
    else    {
        boot(XplayerConfig);
    }
})()


// Run on doc ready
/*$(() => {
    
})()*/

