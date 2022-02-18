/**
 * Digit LCD Display
 * v0.1
 * 
 * wolo.pl '.' studio
 * 2022
 *
 * Replace number / time string value with oldschool analog led digits.
 * Supports numbers, semicolon and slash.
 * Use:
 *  <span id="..." class="time digitall listenUpdate" data-time="0:00"></span>
 *  DigitAll.configure({valueDataKey: 'time'});
 *  DigitAll.initialize( /*{applyTo: '.digitall', listenUpdate: '.digitall.listenUpdate'}*/ /**);
 */


/**
 * 
 */
let DigitAll = {


    // currently active displays
    //instances: {},

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

        DigitAll.config = {
            valueDataKey:      setup?.valueDataKey  
                        ??  'value',
        }

        if (setup?.dev)
            DigitAll.dev = true;
    },


    /**
     * Run setup items, using defined selectors
     * @param selectors Object {
     *      applyTo:        [string] Apply DigitAll
     *      listenUpdate:   [string] Track update of element's data-[config.valueDataKey]
     * }
     */
    initialize: (selectors) => {

        // replace time digits in predefined elements
        $(selectors?.applyTo  ??  '.digitall')
            .each( (i, el) => {
                let value = $(el).data(DigitAll.config.valueDataKey);
                if (DigitAll.dev)   console.info('- apply DigitAll to: '+selectors?.applyTo, el);
                DigitAll.replaceDigitsAndSymbolsInElement(el, value);
            });
        
        $(selectors?.listenUpdate  ??  '.digitall.listenUpdate')
            .each( (i, el) => {
                if (DigitAll.dev)   console.info('- listen update value for: '+selectors?.listenUpdate, el);
                DigitAll.listenUpdate(el);
            });
    },


    listenUpdate: (el) => {
        $(el).bind('datachange', () => {
            //console.log('DATA CHANGED!', el);
            let value = $(el).data(DigitAll.config.valueDataKey);
            DigitAll.replaceDigitsAndSymbolsInElement(el, value);
        });
    },


    replaceDigitsAndSymbolsInElement: (el, value) => {

        let timeValue = (value ?? '')+'';
        // keep only: 0-9:/
        timeValue = timeValue.replace(/[^0-9:\/]/gi, '');
        if (!timeValue) {
            return;
        }
        if (DigitAll.dev)   console.info('- set time value: '+timeValue, el);

        let digitalSymbols = $('<div class="symbols">');
        for (let d = 0; d < timeValue.length; d++) {
            console.log(timeValue.charAt(d));
            digitalSymbols.append(
                DigitAll.renderSymbol(timeValue.charAt(d))
            );
        }


        $(el).html(digitalSymbols);
    },


    /**
     * Build single symbol markup
     * @param symbol String
     * @return {*|jQuery|HTMLElement}
     */
    renderSymbol: symbol => {
        
        // filter available: 0-9/: and length = 1
        let symbolValue = symbol.replace(/[^0-9:\/]/gi, '').substring(0, 1);
        if (!symbolValue.length)   {
            console.error('Cannot render symbol: '+symbol+', invalid value', symbolValue);
            return $('<symbol class="symbol-error dev"></symbol>');
        }
        //console.log(symbolValue);

        let symbolClass = '';
        if (/[0-9]/.test(symbolValue)) {
            symbolClass = 'digit digit-'+symbolValue;
        }
        else if (/[:]/.test(symbolValue)) {
            symbolClass = 'symbol-semicolon';
        }
        else if (/[\/]/.test(symbolValue)) {
            symbolClass = 'symbol-slash';
        }
        
        return $('<symbol class="symbol '+symbolClass+'" title="'+symbolValue+'">')
                .append(
                    $('<div class="el line top horizontal">'),
                    $('<div class="el line middle horizontal">'),
                    $('<div class="el line bottom horizontal">'),
                    $('<div class="el line lefttop vertical">'),
                    $('<div class="el line leftbottom vertical">'),
                    $('<div class="el line righttop vertical">'),
                    $('<div class="el line rightbottom vertical">'),
                    $('<div class="el dot top">'),
                    $('<div class="el dot bottom">'),
                    $('<div class="el slash top">'),
                    $('<div class="el slash bottom">')
        );
    },

    

    formatTime: seconds => {
        let durationMinutes = parseInt(seconds / 60, 10);
        let durationSeconds = parseInt(seconds % 60);
        return durationMinutes + ':' + durationSeconds.toString().padStart(2, '0');
    },
};




// test
/*(() => {
    'use strict'

    DigitAll.configure({dev: true});
    DigitAll.initialize({applyTo: '.digitall'});
})()*/
