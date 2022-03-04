/**
 * Volume Controls - fancy volume UI pots / manipulators / sliders
 * 
 * v0.3
 * 
 * wolo.pl '.' studio
 * 2022
 *
 * Potentiometers, sliders, crossfaders. Linked-value alternative parallel fields (like text input below, or range bar in debug mode. all of them value-synced)
 * General info how it works:
 *  1. It builds markup for nice volume controller [so called: VolumeCtrl]. That markup contains:
 *      - Manipulator DOM (the only visible item) [so called: VolumeManipulator] - that's what we're here for.
 *      - Range input (hidden. treat as main input for value get/set [is this actually needed?]) - optionally unhidden for dev/debug/tests.
 *      - Text input (hidden|optional) - May be used to display current value (with attr readonly), or to manually type in the value.
 *  2. It links these inputs values to stay in sync as a whole, when any of them changes. Also it tracks own overall
 *      value state (in data prop of wrapper) and using that one is the recommended way to work with.
 *  3. It takes care of specific CSS cases, like automatic recalculation of gradient angle or shadow drop offset, when
 *      dealing with rotating items.
 *  4. It allows to use custom methods for markup prepare and item assembly, to jump in into the setup process and tune
 *      parts to own needs.
 *  
 * Use:
 *  <volume id="rotarypot_test" class="is-loading" data-type="RotaryPot" data-min="" data-max="" data-value=""></volume>
 *  
 *      VolumeControls.configure([json Optional global config]);
 *          // auto-init - setup all found elements by default selector ('.is-loading') - use with dom ready situations with prepared elements waiting there 
 *      // VolumeControls.initialize();
 *          // setup individually - setup specified element on demand - use with dynamic build, ajax etc.
 *      $(el).vc_makeRotaryPot([json Optional item config]);
 *          // or:
 *      // $(el).vc_makeVolumeCtrl([json Optional item config], 'RotaryPot');
 *          // or set by attr data-type || use default
 *      // $(el).vc_makeVolumeCtrl([json Optional item config]);
 *          // or
 *      // VolumeControls.setupInstance_VolumeCtrl(el, conf, 'RotaryPot');
 */




/**
 * @requires Utility
 */
let VolumeControls = {


    // global configuration
    config: {},

    dev: false,

    ready: false,



    /**
     * Set config, handle incoming/external json, set defaults
     * @param setup json
     */
    configure: setup => {
        if (typeof setup === 'undefined')
            setup = {};

        VolumeControls.config = {
                // selector to element where to embed Reel Player
            applyToSelector:      setup?.applyToSelector
                           ??  '.volume-controller.is-loading',

                // selector for tester container
            testerRunInSelector:      setup?.testerRunInSelector
                           ??  'main',

                // property data-[xxx] which keeps item's raw value (string/int)
            valueDataKey:       setup?.valueDataKey
                        ??  'value',

                // markup prepare using custom callable
            markupPrepareFunc:  typeof setup?.markupPrepareFunc === 'function'  
                        ?   setup?.markupPrepareFunc
                        :   VolumeControls.prepareMarkupParts_VolumeCtrl,

                // markup build using custom callable.
            markupBuildFunc:  typeof setup?.markupBuildFunc === 'function'  
                        ?   setup?.markupBuildFunc
                        :   VolumeControls.buildMarkup_VolumeCtrl,
        }

        if (setup?.dev)
            VolumeControls.dev = true;

        VolumeControls.ready = true;

        return VolumeControls;
    },



    /** VOLUME CONTROLLER */
    


	/**
     * Run setup items, using defined selectors
     * @param selectors Object {
     *      applyTo:        [string] Apply VolumeControls
     * }
     */
    initialize: (selectors) => {
        if (!VolumeControls.ready)
            VolumeControls.configure();
        let applyTo = selectors?.applyTo  ||  VolumeControls.config.applyToSelector;
        // let listenUpdate = selectors?.listenUpdate  ||  '.digitall.listenUpdate';
        console.log('applyTo SELECTOR: ',  applyTo);

        $(applyTo).each( (i, el) => {
            if (VolumeControls.dev)   console.info('- apply VolumeControls to: '+selectors?.applyTo, el);
            let conf = {};
            VolumeControls.setupInstance_VolumeCtrl(el, conf);
        });

        return VolumeControls;
    },






    /**
 
        ROTARY POT

     */



	/**
     * Setup single dom element
     * @param el obj instance
     * @param manipulatorType string
     * @param conf json
     */
    setupInstance_VolumeCtrl: (el, manipulatorType, conf) => {
        // todo: type (currently only RotaryPot, but prepare for more types)
        if (!VolumeControls.ready)
            VolumeControls.configure();

        if (el.hasClass('is-set')  ||  ! $(el).hasClass('is-loading'))  {
            return console.info('- volume controller already set for this element, or no required "is-loading" initial class is set. nothing to do, exit.');
        }

        conf = VolumeControls.setConfDefaultsIfNotSet(conf);
        manipulatorType = manipulatorType  ??  el.data('type')  ??  conf.type;

        if (!el.hasChildNodes)  {
            // console.log('- EL EMPTY. build markup inside');  // do we even allow situation, where markup is already built?
            let identifier = conf?.identifier ?? 'volume_ctrl_'+Utility.randomInt(9999);
            let __markupPrepareFunc = typeof conf?.markupPrepareFunc === 'function' ? conf.markupPrepareFunc : VolumeControls.config.markupPrepareFunc;
            let __markupBuildFunc = typeof conf?.markupBuildFunc === 'function' ? conf.markupBuildFunc : VolumeControls.config.markupBuildFunc;

            // prepare markup parts
            let preparedParts = __markupPrepareFunc(el, identifier, manipulatorType, conf);
            // build markup using prepared parts
            __markupBuildFunc(el, preparedParts, conf);
        }


        VolumeControls.linkSubInputsValue(el);
        VolumeControls.setManipulatorStateRotaryPot(el, conf.value, true);

        el.removeClass('is-loading').addClass('is-set');
	},


    linkSubInputsValue: (elCtrl) => {
        let elId = elCtrl.attr('id');

        // query them in whole document - it might've been moved somewhere else in custom solutions
        let inputMain = $('#'+elId+'__main');
        let inputText = $('#'+elId+'__text');
        let manipulator = $('#'+elId+'__manipulator');

        // store references to them in el.data
        elCtrl.vc_setDataKey( 'inputsLinked', {
            inputMain: inputMain,
            inputText: inputText,
            manipulator: manipulator,
        });


        // text input
        inputText.on( 'keyup change', () => {
                //console.log('input Text changed! - attempt to sync values');
                // prevent typing beyond scope. use ranges set in Ctrl el
                let value = Utility.forceNumberInScope(inputText.val(), elCtrl.vc_getDataKey('min'), elCtrl.vc_getDataKey('max'));
                // set value again (possibly scope corrected)
                inputText.val(value).attr('value', value);
                // set to opposite range input
                inputMain.val(value).attr('value', value);

                VolumeControls.setVolumeCtrlValue(elCtrl, value, true);
        });
        inputText.addClass('value-sync-set');

        // range input
        inputMain.on( 'input change', () => {
                // console.log('input Main changed! - attempt to sync values');
                // prevent value beyond the scope
                let value = Utility.forceNumberInScope(inputMain.val(), elCtrl.vc_getDataKey('min'), elCtrl.vc_getDataKey('max'));
                // set value again (possibly scope corrected). also update value attr, to visualize that change
                inputMain.val(value).attr('value', value);
                // set to opposite txt input
                inputText.val(value).attr('value', value);

                VolumeControls.setVolumeCtrlValue(elCtrl, value, true);
        });
        inputMain.addClass('value-sync-set');
    },



    /**
     * Make sure essential configuration keys are there
     * @param conf
     * @return {{maxValue}|*}
     */
    setConfDefaultsIfNotSet: (conf) => {
        // todo later: handle various types here! or maybe make separate default conf methods for each?
        if (typeof conf === 'undefined')
            conf = {};
        conf.value = conf?.value  ??  0;  
        conf.min = conf?.min  ??  0;
        conf.max = conf?.max  ??  100;    // if not specified, make it a basic percentage scope
        conf.type = conf?.type  ??  'RotaryPot';

        return conf;
    },


    /**
     * @param elCtrl object|jQuery
     * @param identifier string Unique string, used to build id's and linking items
     * @param manipulatorType string ['RotaryPot'|?] Manipulator type
     * @param conf json
     * @return array parts used to assemble final markup. process before build, if needed
     */
    prepareMarkupParts_VolumeCtrl: (elCtrl, identifier, manipulatorType, conf) => {
        if (!VolumeControls.ready)
            VolumeControls.configure();
        if (VolumeControls.dev) console.log('* internal - PREPARE parts for identifier: ' + identifier + ' manipulator type: ' + manipulatorType);

        switch (manipulatorType)   {
            case 'RotaryPot':
            default:
                return {
                    ctrl_volume_manipulator: $('<manipulator id="'+identifier+'__manipulator">')
                        .append(
                                VolumeControls.buildScaleRotaryPot($('<scale>'), elCtrl, conf),
                                $('<knob>').append(
                                    $('<rondo> <pointer>'),   // bottom part of knob, above scale
                                    $('<turn> <pointer>')
                                )
                        ),
                    ctrl_volume_text: $('<input type="text" id="'+identifier+'__text" class="range-text" value="'+ conf.value +'">'),
                    ctrl_volume: $('<input type="range" id="'+identifier+'__main" min="'+ conf.min +'" max="'+ conf.max +'" value="'+ conf.value +'">'), 
                };
        }
    },

    /**
     * Assembly final markup
     * @param elCtrl Object|jQuery El VolumeCtrl - general wrapper
     * @param preparedParts json
     * @param conf json
     */
    buildMarkup_VolumeCtrl: (elCtrl, preparedParts, conf) => {
        if (!VolumeControls.ready)
            VolumeControls.configure();
        if (VolumeControls.dev) console.log('* internal - BUILD from incoming parts: ', preparedParts);

        elCtrl.addClass('oftype-'+ conf.type.toLowerCase());

        elCtrl.vc_setDataKey('min', conf.min, true)
              .vc_setDataKey('max', conf.max, true)
              .vc_setDataKey('value', conf.value, true);

        elCtrl.append(
            preparedParts.ctrl_volume_manipulator   ?? '[warn: no prepared parts.ctrl_volume_manipulator]',
            preparedParts.ctrl_volume_text          ?? '[warn: no prepared parts.ctrl_volume_text]',
            preparedParts.ctrl_volume               ?? '[warn: no prepared parts.ctrl_volume]',
        );



        // Sync related inputs values
        //  (set_volume_sync.vc.ctrl is not triggered when volume was updated from opposite listener, to avoid endless loop.
        //  To listen to every volume change, handle trigger "set_volume.vc.ctrl")
        elCtrl.on('set_volume_sync.vc.ctrl', (e, data) => {
                let value = data.volumeValue;
                //console.log('Sync volume = ', value);
                preparedParts.ctrl_volume_text.val(value);
                preparedParts.ctrl_volume.val(value);
        });



        preparedParts.ctrl_volume_manipulator.on('mousedown', (e) => {

            // keep starting value for move offset calculation.
            let startY = e.clientY;

            let onMouseMove = (e) => {
                    //console.log(e);
                    e.preventDefault();
                    VolumeControls._handleMouseMove(elCtrl, startY, e.clientX, e.clientY, onMouseMove);
            };

            let onMouseUp = (e) => {
                    //console.log('MOUSE UP - clean MOUSEMOVE listener, EXIT');
                    e.preventDefault();
                    $(document).off('mousemove', onMouseMove);
                    $(document).off('mouseup', onMouseUp);
            };


            // Mouse MOVE - track the distance and sync distance with volume value
            $(document).on('mousemove', onMouseMove);


            // Mouse click RELEASED - finish, unbind and exit
            $(document).on('mouseup', onMouseUp);

        });
    },



    _handleMouseMove: (elCtrl, startY, clientX, clientY,  onMouseMove) => {
        let deltaPx = startY - clientY;
        
        // without that check and unregistering listener also here, it sometimes doesn't trigger mouseup,
        // (like, when released above audioplayer) and still handles move
        if (document.body.matches(':active'))   {
            // console.log('== MOVE BY', deltaPx);

            let valueCurrent = elCtrl.vc_getDataKey('value');

            // now from px distance calculate the value change. we cannot assume 1px = val change by 1, so estimate a modifier number to slow the responsibility a little
            let valUpdateSpeedReductionFactor = 0.05;
            let valueNew = parseInt(valueCurrent) + (deltaPx * valUpdateSpeedReductionFactor);

            valueNew = valueNew.toFixed(2);
            // console.log('valueNew', valueNew);
            // console.log('- VALUE CHANGE BY:', deltaPx * valUpdateSpeedReductionFactor);

            VolumeControls.setVolumeCtrlValue(elCtrl, valueNew);

            // reset calculation ref to current, to smoothen the behaviour
            if (valueNew >= 100 || valueNew <= 0) {
                startY = clientY;
            }
        }
        else    {
            $(document).off('mousemove', onMouseMove);
            console.log('UNREGISTER MOVE LISTENER');
        }
    },


    /**
     * Set volume value to the whole Ctrl item. It takes care about value evaluation, validation, events, propagate
     * the value to its sub parts and update manipulator state.
     * @param elCtrl
     * @param value
     * @param silent bool When calling from synchronize context (like, text input onchange handler)
     *              - then set this to true, to not trigger sync event and stuck in endless loop, when handlers will try to update all the values again
     */
    setVolumeCtrlValue: (elCtrl, value, silent) => {
        // todo later: handle various types here, not only rotary */
        value = Utility.forceNumberInScope(value, elCtrl.vc_getDataKey('min'), elCtrl.vc_getDataKey('max'));
        let inputsLinked = elCtrl.vc_getDataKey( 'inputsLinked');
        let elManipulator = inputsLinked?.manipulator;

        elCtrl.vc_setDataKey('value', value, true)
        VolumeControls.setManipulatorStateRotaryPot(elManipulator, value);
        if (!silent)  {
            // trigger volume sync event
            elCtrl.trigger('set_volume_sync.vc.ctrl', {volumeValue: value});
        }
        elCtrl.trigger('set_volume.vc.ctrl', {volumeValue: value});
    },


    // todo: FINISH
    /**
     * Visual State of the manipulator
     * @param el
     * @param valuePercent
     */
    setManipulatorStateRotaryPot: (el, valuePercent) => {

        if (valuePercent < 0)   {
            valuePercent = 0;
        }

        // I assume here, that every volume slider input has values 0-100 and that we can
        // here basically expect the percentage value. if you need to use it with other scope,
        // pass them and calculate valuePercent here using them.
        //let valuePercent = $(el).data('value');
        // todo: set these using data prop
        let minRotationAngle = 225;     // about 7:30
        let maxRotationAngle = 135;     // about 4:30
        let rotateOrientation = 'R';     // clockwise: value +
        
        // todo later: store references to them and just iterate, instead of querying each time
        let knob = $(el).find('knob');
        let turn = $(el).find('turn');
        let rondo = $(el).find('rondo');


        // calculate degree between these min/max, respecting rotation dir. todo later: orientation=L
        if (rotateOrientation === 'R')   {
            let angleBetween = 360-minRotationAngle + maxRotationAngle;

            // calculate degree for incoming percent value
            let degreesFromPercentOfScope = angleBetween * valuePercent / 100;
            // but it's calculated according to 0 - so we must go back by minrotation degrees
            let finalAngle = Utility.angleWithinOneFullRotation(minRotationAngle + degreesFromPercentOfScope);
            // console.log('DEG', degreesFromPercentOfScope);
            // console.log('finalAngle', finalAngle);

            // - Rotate the whole controller item

            // $(el).css("transform", 'rotate('+finalAngle+'deg);'});   // doesn't work. need this:
            $(knob).css({ WebkitTransform: 'rotate(' + finalAngle + 'deg)'});


            // - Rotation visual corrections

            // -- Gradient angle update
            // --- Rondo
            Utility.gradientAngleUpdate(rondo, finalAngle);
            // --- Turn
            Utility.gradientAngleUpdate(turn, finalAngle);

            // -- Shadow offset recalculate
            // --- Knob
            Utility.shadowDropOffsetRecalculate(knob, finalAngle);
            // --- Turn
            Utility.shadowDropOffsetRecalculate(turn, finalAngle);
        }
    },


    /**
     * Scale for controller - append lines at calculated positions
     */
    buildScaleRotaryPot: (elScale, elCtrl, localConf) => {
        let conf = VolumeControls.config;
        // todo later: first use data- attribs, before localConf values, for some/all options

        let divideTo = conf?.divideTo ??                    10;   // 2 parts = 3 lines! 
        let oversizeStep = conf?.oversizeStep ??            2;   // 5px each step 
        let baseMarkHeight = conf?.baseMarkHeight ??        10;

        let minRotationAngle = conf?.minRotationAngle ??    225;     // about 7:30
        let maxRotationAngle = conf?.maxRotationAngle ??    135;     // about 4:30
        let rotateOrientation = conf?.rotateOrientation ??  'R';     // clockwise: value +



        let angleBetween;
        let correctionDegrees;
        if (rotateOrientation === 'R')   {
            angleBetween = 360 - minRotationAngle + maxRotationAngle;
            // if startingRotation is lower than 0 deg
            correctionDegrees = 360 - minRotationAngle;
        }
        // calculate offset in deg
        let stepInDegrees = angleBetween / divideTo;

        
        // if startingRotation is lower than 0

        for (let m=0; m<=divideTo; m++) {

            let offsetInDegrees = m * stepInDegrees;
            let cssHeightOffset = 0;
            let classAttr = '';

            // first item customize
            if (m === 0)   {
            }
            // last item customize
            else if (m === divideTo)   {
            }
            // all other
            else    {
                cssHeightOffset = oversizeStep;
                classAttr = 'indent';
            }

            // correction for rotation to the Min position, respecting rotation dir. todo later: orientation=L
            if (rotateOrientation === 'R')   {
                offsetInDegrees -= correctionDegrees;
            }


            elScale.append(
                //$('<scaledivider style="transform: rotate('+offsetInDegrees+'deg);"><markline style="top: '+cssHeightOffset+'px;">')
                $('<scaledivider style="transform: rotate('+offsetInDegrees+'deg);"><markline class="'+classAttr+'" style="">')
            );
        }

        return elScale;
    },




    /**

        CROSSFADER

     */


    /**
     * 
     * // todo: rework, like rotarypot, allow multiple instances
     */
    initCrossfader: (conf, callbackAfterCreate, callbackAfterSlide, callbackAfterChange) => {
        $('#crossfader-ab').slider({
            range:      conf?.range ??  'min',
            min:        conf?.min ??    -100,
            max:        conf?.max ??    100,
            value:      conf?.value ??  0,
            animate:    conf?.animate ?? 'fast',
            classes:    conf?.classes ?? {
                'ui-slider': 'volume-ctrl  oftype-crossfader',
                'ui-slider-handle': 'fader-handle',
                'ui-slider-range': 'fader-range',
            },
            // start: () => {   // stop: () => {
            change: (e, ui) => {
                if (typeof callbackAfterChange === 'function') {
                    callbackAfterChange(e, ui); 
                }
            },
            create: (e, ui) => {
                // reset and append some additional markup

// todo: check that! move to callback
                VolumeControls.setCrossfaderVolumeValue(Xplayer.config.crossfader_initial);
                $('#crossfader-ab .fader-handle').append(
                    $('<span class="inner">'),
                    $('<span class="cut">')
                );

                // build scale
                VolumeControls.buildScaleCrossfader();

                if (typeof callbackAfterCreate === 'function') {
                    callbackAfterCreate(e, ui); 
                }
            },
            slide: (e, ui) => {
                VolumeControls.setCrossfaderVolumeValue(ui.value);

                if (typeof callbackAfterSlide === 'function') {
                    callbackAfterSlide(e, ui); 
                }
            },
        });
        
        // text input
        $('input#crossfader-ab-value').change(e => {
            // v1  // value = $(e.target).map(() => { return $(this).val(); })[0];
            // v2
            let value = $(e.target).prop('value');
            // v3 - doesn't work!  // value = $(e.target[0]).val());
            // v4  // value = $(e.target)[0].value;

            $('#crossfader-ab').slider( 'option', 'value', value);
        });
    },


    buildScaleCrossfader: () => {

        // scale STYLE A
        // let divideTo = 32;
        // let oversizeEvery_4 = 1.6;
        // let oversizeEvery_2 = 1.2;
        // let baseMarkHeight = 30;

        // scale STYLE B
        let divideTo = 16;
        let oversizeStep = 5;   // 5px each step 
        let baseMarkHeight = 50;


        // todo: pass/read that!
        let scale = $('.crossfader-wrap .scale');
        // calculate offset in % instead of px! it works best and everywhere
        let stepInPercent = 100 / divideTo;

        for (let m=0; m<=divideTo; m++) {
            let offsetInPercent = m * stepInPercent;
            let cssHeight = baseMarkHeight;

            // STYLE B
            if (offsetInPercent < 50)   {
                cssHeight = baseMarkHeight - (m * oversizeStep); 
            }
            else if (offsetInPercent > 50)   {
                cssHeight = baseMarkHeight - ((divideTo - m)  * oversizeStep); 
            }

                // STYLE A
                /*if (!(m%2))   {
                    cssHeight = 'height: '+ (oversizeEvery_2 * baseMarkHeight) + 'px';
                }
                if (!(m%4))   {
                    cssHeight = 'height: '+ (oversizeEvery_4 * baseMarkHeight) + 'px';
                }*/

            $(scale).append(
                $('<div class="markline" style="left: '+offsetInPercent+'%; height: '+cssHeight+'px;">')
            );
        }
    },



    setCrossfaderVolumeValue: (value) => {

        value = parseInt(value);
        // snap to center, in this scope
        if (value > -3  &&  value < 3)    {
            value = 0;
        }
        $('#crossfader-ab-value').val(value);
        $('#crossfader-ab').slider( 'option', 'value', value);

        // apply changes to tracks volume balance
// todo: try to use references! pass or smth
// todo: change characteristics / how it calculates A B volumes
// todo later: register the two elements to fade between. now just assume they name #player_N
        VolumeControls.setVolumeCtrlValue($('volume#player_A'), Utility.forceNumberInScope(100 - value, 0, 100));
        VolumeControls.setVolumeCtrlValue($('volume#player_B'), Utility.forceNumberInScope(100 + value, 0, 100));
    },



    /** MISC */



    /**
     * Set DATA
     * @param el jQuery|object
     * @param key string
     * @param val mixed
     * @param alsoSetAttr bool
     */
    setDataKey: (el, key, val, alsoSetAttr) => {
        el.data(key, val);
        // is probably not needed for anything, but good to have this updated at least with main value to see what's going on
        if (alsoSetAttr)   {
            el.attr('data-'+key, val);
        }
    },

    /**
     * Get DATA
     * @param el jQuery|object
     * @param key string
     * @return mixed
     */
    getDataKey: (el, key) => {
        return el.data(key);
    },



    /**
     * Test - playground sandbox
     * By default - runs in full-page, replacing other contents of page (see config for dom selector)
     */
    runTester: (whatToTest) => {
        VolumeControls.configure();
		let item;
		switch (whatToTest)	{
			case 'Crossfader':
                    item = $('<volume id="vc_crossfader_test" class="volume-ctrl  is-loading" data-type="Crossfader"></volume>');
                    break;
			case 'VolumeRotaryPot':
			default:
                    item = $('<volume style="--vc-size: 4;" id="vc_rotarypot_test" class="volume-ctrl  is-loading" data-type="RotaryPot"></volume>');
                    break;
		}

        $(VolumeControls.config.testerRunInSelector)
            //.addClass('high-contrast')
            .empty().append(
                $('<h3>VolumeControls - fancy volume test playground</h3>'),
                item
            );

        // call global init, which will set up all found items according to global conf's selector, supposedly also our. 
        //  VolumeControls.initialize();
        // or - explicitly init Pot item, using $.fn on Dom el, with example pass of custom markup callables
        //  (alternatively - .vc_makeVolumeCtrl({}, 'RotaryPot'); )   
        item.vc_makeRotaryPot({
            value: 16,
            max: 85,
            markupPrepareFunc: (el, identifier, manipulatorType, conf) => {
                // console.log('CUSTOM markupPrepareFunc. item ident: ' + identifier);
                return VolumeControls.prepareMarkupParts_VolumeCtrl(el, identifier, manipulatorType, conf);
            },
            markupBuildFunc: (el, preparedParts, conf) => {
                // console.log('CUSTOM markupBuildFunc');
                VolumeControls.buildMarkup_VolumeCtrl(el, preparedParts, conf);
            },
        });
    },
}


// !! WARNING !! using short syntax doesn't work for $.fn for some reason!
$.fn.extend({


    // setup Volume Ctrl on dom el - of type default or set in data-type attr
    vc_makeVolumeCtrl: function(conf, manipulatorType) {
        let el = this;
        if (typeof conf === 'undefined')
            conf = {};
        if (!conf?.identifier  &&  el.prop('id'))
            conf.identifier = el.prop('id');
 
        VolumeControls.setupInstance_VolumeCtrl(el, manipulatorType, conf);
    },


    // setup Rotary Pot on dom el
    vc_makeRotaryPot: function(conf) {
        this.vc_makeVolumeCtrl(conf, 'RotaryPot');
    },


    // get Data key shorthand
    vc_getDataKey: function(key) {
        let el = this;
        return VolumeControls.getDataKey(el, key);
    },

    // set Data key shorthand
    vc_setDataKey: function(key, val, alsoSetAttr) {
        let el = this;
        VolumeControls.setDataKey(el, key, val, alsoSetAttr);
        return el;
    },
});




// test
/*(() => {
    'use strict'

    VolumeControls.configure({dev: true});
    // $('#some-div').VolumeRotaryPot();

})()*/


