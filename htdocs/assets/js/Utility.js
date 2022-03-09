/**
 * General use utilities / tools / helpers
 */
let Utility = {


    formatTime: (seconds) => {
        let durationMinutes = parseInt(seconds / 60, 10);
        let durationSeconds = parseInt(seconds % 60);
        return durationMinutes + ':' + durationSeconds.toString().padStart(2, '0');
    },


    /**
     * Update offset coordinates (like these in shadow drop) by given rotation degrees
     * @param x {number} From-offset X
     * @param y {number} From-offset Y
     * @param deg {number} Rotate by degrees
     * @return {number[]}
     */
    updateOffsetCoordsByRotateAngle: (x, y, deg) => {
        x = parseInt(x);
        y = parseInt(y);
        let radians = deg * Math.PI / 180;
        let sin = Math.sin(radians);
        let cos = Math.cos(radians);

        return {
            x: Math.round((x * cos + y * sin) * 100) / 100,
            y: Math.round((-x * sin + y * cos) * 100) / 100
        };
    },


    /**
     * Trim each full rotation from given degrees (return the same angle but ensures it's between 0 - 360)
     * @param deg {number} Degrees incoming
     * @return {number} Degrees corrected
     */
    angleWithinOneFullRotation: (deg) => {
        if (deg > 360  ||  deg < -360)  {
            return deg % 360;
        }
        return deg;
    },


    /**
     * Process gradient angle, when item is rotated - recalculate and update current gradient css for item
     * @param el
     * @param deg {number}
     */
    gradientAngleUpdate: (el, deg) => {
        if (!el.get(0)) {
            return;
        }

        // look for original css we might have stored before, - or read from window computed and store for later
        let dataOriginalCss = el.prop('data-originalCssGradient');
        if (!dataOriginalCss)   {
            // expect this string like that: "linear-gradient(155deg, rgb(95, 47, 47) 25%, rgb(27, 15, 15) 75%)" if this ever stops to work, check this first!
            let _originalComputedStyle = window.getComputedStyle(el.get(0)).backgroundImage ?? '';
            let _parts = _originalComputedStyle.match(/linear-gradient\((.*)deg,(.*)\)/) || [];
            dataOriginalCss = {
                gradientAngle: _parts[1] ?? 0,    // what we need is the original angle value,
                restOfDefinition: _parts[2] ?? '', // and the following original string, like colours etc. needed to be set with angle, as a whole
                // keep just in case
                full: _originalComputedStyle, 
                parts: _parts, 
            }
            el.prop('data-originalCssGradient', dataOriginalCss)
        }

        let correctionAngle = parseInt(dataOriginalCss.gradientAngle) - deg;
        let correctionAngleFixed = Utility.angleWithinOneFullRotation(correctionAngle) 

        // console.log('original CSS DATA: ', dataOriginalCss);
        // console.log('itemFinalAngle', deg);
        // console.log('- correctionAngleFixed', correctionAngleFixed);

        //$(el).attr('style', 'background-image: linear-gradient('+correctionAngleFixed+'deg, '+dataOriginalCss.restOfDefinition+')');
        $(el).css({backgroundImage: 'linear-gradient('+correctionAngleFixed+'deg, '+dataOriginalCss.restOfDefinition+')'});
    },


    /**
     * Process css shadows, when item is rotated - recalculate and update drop coords by given degrees
     * @param el
     * @param deg {number}
     */
    shadowDropOffsetRecalculate: (el, deg) => {
        if (!el.get(0)) {
            return;
        }

        // look for original css we might have stored before, - or read from window computed and store for later
        let dataOriginalCss = el.prop('data-originalCssShadow');
        if (!dataOriginalCss)   {
            // expect this string like that: "rgba(8, 8, 8, 0.65) 3px 2px 6px 0px inset". if this ever stops to work, check this first!
            let _originalComputedStyle = window.getComputedStyle(el.get(0)).boxShadow ?? '';
            let _parts = _originalComputedStyle.match(/(rgba.*\)) (.+) ?(inset|)?/) ?? [];
            let _coords = _parts[2]?.split(' ') ?? [];
            dataOriginalCss = {
                shadowOffsetX: _coords[0] ?? 0,    // what we need is the original offset values,
                shadowOffsetY: _coords[1] ?? 0,
                color: _parts[1] ?? '',     // and the rest of original definition. needed to be set with drop offset, as a whole.
                blurSpread: _coords[2] +' '+ (_coords[3] ?? ''),
                //inset: _parts[3] ?? '',
                inset: _coords[4] ?? '',    // [in general, inset should be in parts[3], but I cannot make a good regexp for this to work right now... (not very important, as of now)]
                // keep just in case
                full: _originalComputedStyle, 
                parts: _parts,
                coordsAll: _coords,
            }
            el.prop('data-originalCssShadow', dataOriginalCss)
        }

        let newOffset = Utility.updateOffsetCoordsByRotateAngle(dataOriginalCss.shadowOffsetX, dataOriginalCss.shadowOffsetY, deg);
        let newDefinition = [dataOriginalCss.color, newOffset.x+'px', newOffset.y+'px', dataOriginalCss.blurSpread, dataOriginalCss.inset].join(' ');

        // console.log('original CSS DATA: ', dataOriginalCss);
        // console.log('newDefinition: ', newDefinition);
        // console.log('itemFinalAngle', deg);

        $(el).css({boxShadow: newDefinition});

            // $(el).find('.cut').css({boxShadow: (inset ? 'inset ' : '') + newOffset[0] + 'px ' + newOffset[1] + 'px ' + blurSpreadColor});         
            //$(el).css({boxShadow: (inset ? 'inset ' : '') + newOffset[0] + 'px ' + newOffset[1] + 'px ' + blurSpreadColor});
    },


    /**
     * Get random number from given scope
     * @param numA MAX value if !B, or MIN if both specified
     * @param numB optional MAX value
     */
    randomInt: (numA, numB) => {
        if (typeof numB === 'undefined') {
            return Math.floor(Math.random() * (numA + 1));
        }
        let min = parseInt(numA);
        let max = parseInt(numB);
        // validate
        if (min >= max) {
            return max;
        }
        // final From-To randomize
        return Math.floor(Math.random() * (max + 1 - min) + min);
    },


    /**
     * Force the value to be within given min-max scope
     * @param value number
     * @param min number
     * @param max number
     * @param asFloat bool
     */
    forceNumberInScope: (value, min, max, asFloat) => {
        if (asFloat)    {
            value = parseFloat(value);
            min = parseFloat(min);
            max = parseFloat(max);    
        }
        else    {
            value = parseInt(value);
            min = parseInt(min);
            max = parseInt(max);
        }
        // validate
        if (min >= max) {
            return max;
        }
        // final From-To force
        return Math.min(Math.max(value, min), max);
    },


    /**
     * Mass dom replace
     * @param input Json as Selector => (function|string)
     */
    replaceDomElements: (input) => {
        for (const [selector, replacement]  of  Object.entries(input)) {
            let el = $(selector);
            if (!el.length)  {
                return;
            }
            switch (typeof replacement)    {
                case 'string':
                    el.get(0).innerHTML = '';
                    break;
                case 'function':
                    el.get(0).innerHTML = replacement();
                    break;
            }
        }
    },



    /**
     * Link range inputs with their text fields
     * @param selector string Range inputs. You may be limit the selector here
     */
    linkRangeInputs: (selector) => {
        if (!selector)
            selector = 'input[type=range]';
        $( selector ).each( (i, el) => {
            // take range input and find its text input by id
            let range = $(el),
                text = $( '#' + range.prop('id').replace('__range', '') );

            text.on( 'keyup change', () => {
                // prevent typing beyond range's scope
                let value = Utility.forceNumberInScope(text.val(), range.prop('min'), range.prop('max'));
                text.val( value );
                range.val( value );
            }).addClass('linked-to-rangeinput');

            range.on( 'input change', () => {
                text.val( range.val() );
                text.trigger('change');
            }).addClass('linked-to-textinput');
        });
    },

}
