/**
 * Reel Tape - animated simulation of oldschool tape player 
 * 
 * v0.1
 * 
 * wolo.pl '.' studio
 * 2022
 *
 * Reel tape 
 * Use:
     *  // <span id="..." class="time digitall listenUpdate" data-time="0:00"></span>
     *  // ReelTape.configure()
     *  //  .initialize();
     *  // ReelTape.start();    // .stop(); // .pause();
 */


/**
 * 
 */
let ReelTape = {


    //instances: {},
    instance: null,

    // global configuration
    config: {},

    dev: false,


    /**
     * Set config, handle incoming/external json, set defaults
     * @param setup json
     */
    configure: setup => {
        if (typeof setup === 'undefined')
            setup = {};

        ReelTape.config = {
                // selector to element where to embed Reel Player
            applyToSelector:      setup?.applyToSelector
                           ??  '#animated_reel',

                // selector for tester container
            testerRunInSelector:      setup?.testerRunInSelector
                           ??  'main',

        }

        if (setup?.dev)
            ReelTape.dev = true;
        
        return this;
    },


    /**
     * Run setup, using defined selectors (actually, currently only single instance is supported)
     */
    initialize: () => {

        // build markup

        let reel = $(ReelTape.config.applyToSelector)
            .addClass('reel spin-stopped');

        ReelTape.instance = $(reel[0]);
        ReelTape.instance.append(
                    $('<w_roll class="left"></w_roll>' +
                     '<w_roll class="right"></w_roll>' +

                     '<w_roll_shadow class="left"></w_roll_shadow>' +
                     '<w_roll_shadow class="right"></w_roll_shadow>' +
                     '<w_roll_blink class="left"></w_roll_blink>' +
                     '<w_roll_blink class="right"></w_roll_blink>' +
                     '<div class="power"></div>' +
                     '<div class="readheader">' +
                         '<div class="tape tape-left"></div>' +
                         '<div class="tape tape-right"></div>' +
                         '<div class="tape tape-middle"></div>' +
                         '<div class="thehead"></div>' +
                     '</div>'));


        ReelTape.instance.find('.power').on('dblclick', () => {
            ReelTape.instance.toggleClass('spin-playing').toggleClass('spin-stopped');
        });

        return this;

                /*
                // replace time digits in predefined elements
                $(applyTo).each( (i, el) => {
                        let value = $(el).data(DigitAll.config.valueDataKey);
                });
               
                // make one of test symbols auto-cycle value
                    $('.test '+applyTo+'.cycle').each( (i, el) => {
                        let testChars = '0123456789:/';
                        let d = 0;
                        let cycle = setInterval(() => {
                            let value = testChars[d];
                            if (++d >= testChars.length)    {
                                d = 0;
                            }
                            DigitAll.replaceDigitsAndSymbolsInElement(el, value);
                        }, 1000);
                    });
                }*/
    },


    /**
     * Test - playground sandbox
     * By default - runs in full-page, replacing other contents of page (see config for dom selector)
     */
    runTester: () => {
        ReelTape.configure();
        let testContainer = $(ReelTape.config.testerRunInSelector)
            .empty().append($('<div id="animated_reel"></div>'));
        ReelTape.initialize();
        
    },

    
    start: () => {
        if (!ReelTape.instance)    {
            return console.error('ReelTape Not initialized? Instance not set');
        }
        ReelTape.instance.addClass('spin-playing').removeClass('spin-paused spin-stopped');
    },

    stop: () => {
        if (!ReelTape.instance)    {
            return console.error('ReelTape Not initialized? Instance not set');
        }
        ReelTape.instance.addClass('spin-stopped').removeClass('spin-playing spin-paused');
    },

    pause: () => {
        if (!ReelTape.instance)    {
            return console.error('ReelTape Not initialized? Instance not set');
        }
        ReelTape.instance.removeClass('spin-playing').addClass('spin-paused');
    },
};




// test
/*(() => {
    'use strict'

    ReelTape.configure({dev: true});
    ReelTape.initialize({applyTo: '.reel'});
})()*/
