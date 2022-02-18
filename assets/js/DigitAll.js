/**
 * DigitAll - Digit Symbol Analog LCD Display
* 
 * v0.2
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
                // property data-[xxx] which keeps item's raw value (string)
            valueDataKey:      setup?.valueDataKey
                        ??  'value',
                // in dev mode init optional auto-cycle symbol (selector: '.test '+applyTo+'.cycle')
            cycleTest:          setup?.cycleTest
                        ??  false,
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

        let applyTo = selectors?.applyTo  ||  '.digitall';
        let listenUpdate = selectors?.listenUpdate  ||  '.digitall.listenUpdate';

        // replace time digits in predefined elements
        $(applyTo).each( (i, el) => {
                let value = $(el).data(DigitAll.config.valueDataKey);
                if (DigitAll.dev)   console.info('- apply DigitAll to: '+selectors?.applyTo, el);
                DigitAll.replaceDigitsAndSymbolsInElement(el, value);
        });
        
        $(listenUpdate).each( (i, el) => {
                if (DigitAll.dev)   console.info('- listen update value for: '+selectors?.listenUpdate, el);
                DigitAll.listenUpdate(el);
        });

        // make one of test symbols auto-cycle value
        if (DigitAll.dev)   {
            $('.test '+applyTo+'.cycle').each( (i, el) => {
                let testChars = '0123456789:/';
                let d = 0;
                let cycle = setInterval(() => {
                    let value = testChars[d];
                    //d++;
                    if (++d >= testChars.length)    {
                        d = 0;
                    }
                    DigitAll.replaceDigitsAndSymbolsInElement(el, value);
                }, 1000);
            });
        }
    },


    listenUpdate: (el) => {
        $(el).bind('datachange', () => {
            //console.log('DATA CHANGED!', el);
            let value = $(el).data(DigitAll.config.valueDataKey);
            DigitAll.replaceDigitsAndSymbolsInElement(el, value);
        });
    },


    /**
     * Replace innerHtml of element [el] with rendered symbols markup representation of [value] 
     * @param el DOM element
     * @param value String
     * @return {boolean}
     */
    replaceDigitsAndSymbolsInElement: (el, value) => {

        let timeValue = (value ?? '')+'';
        // keep only: 0-9:/
        timeValue = timeValue.replace(/[^0-9:\/]/gi, '');
        if (!timeValue) {
            return false;
        }
        if (DigitAll.dev)   console.info('- set time value: '+timeValue, el);

        // check if symbols already exist
        let digitalSymbols = $(el).find('.symbols symbol');
        let digitalSymbolsWrapper;
        let d = 0;


        if (timeValue.length === digitalSymbols.length) {
            // if number of chars vs. symbol dom elements didn't change, only update them
            if (DigitAll.dev)   console.info('- symbols exists, only update class/data-value where needed');

            for (d; d < timeValue.length; d++) {
                let symbolValue = timeValue.charAt(d);

                // actually update only these which has different value now, leave others
                if ($(digitalSymbols[d]).data('value') !== symbolValue) {
                    $(digitalSymbols[d])
                            .attr('class', DigitAll.getSymbolClass(symbolValue))
                            .attr('title', symbolValue)
                            .data('value', symbolValue);
                }
            }
            return !!d;
        }
        else    {
            // otherwise - insert / replace with new
            digitalSymbolsWrapper = $('<div class="symbols">');

            for (d; d < timeValue.length; d++) {
                let symbolValue = timeValue.charAt(d);

                digitalSymbolsWrapper.append(
                    DigitAll.renderSymbol(symbolValue)
                );
            }
            $(el).html(digitalSymbolsWrapper);
            return !!d;
        }
    },


    /**
     * Build single symbol markup
     * @param symbolChar String
     * @return String
     */
    getSymbolClass: symbolChar => {

        if (/[0-9]/.test(symbolChar)) {
            return 'digit digit-'+symbolChar;
        }
        if (/[:]/.test(symbolChar)) {
            return 'symbol-semicolon';
        }
        if (/[\/]/.test(symbolChar)) {
            return 'symbol-slash';
        }
        return '';
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
        let symbolClass = DigitAll.getSymbolClass(symbolValue) || 'unknown';

        return $('<symbol class="'+symbolClass+'" title="'+symbolValue+'">')
                .data('value', symbolValue)
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
