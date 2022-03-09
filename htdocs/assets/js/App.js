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
     * Hide / remove some dom elements for work (like navbar, or other sticky or big elements which disturbs work by covering everything on big zoom... etc)
     * (array of selector strings)
     */
    HIDE_ELEMENTS_FOR_DEV: [],



    warmUpEnvironment: () => {
        if (document.body.classList.contains('dev-mode'))  {
            App.DEV = true;
        }
    },

};







// Run directly
(() => {
    'use strict'


    // Prepare some values on the very beginning

    App.warmUpEnvironment();




    // Build custom console (dedicated for standalone mode)

    QConsole.configure({dev: App.DEV /*startState: 'expanded'*/});
    QConsole.cliRegisterCommands(Xplayer.cliCommands());    // or call after app config initialize?
    QConsole.available = true;
    $('#console').QC_makeItAConsole();




    // Check node.js availability (standalone mode)

    XplayerNode.initialize();





    // Start the App


// $('.navbar').empty();
// $('#operate-panel').empty();
// return VolumeControls.runTester('VolumeRotaryPot');
// return VolumeControls.runTester('Crossfader');

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

