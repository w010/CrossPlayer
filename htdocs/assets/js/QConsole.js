/**
 * QConsole - simple rollout terminal, in classic Quake-style.
 * Can handle many parallel consoles in the same time, ie. to separate your topics and switch to new empty one.
 * (like in ConEmu)
 * 
 * v0.2
 * 
 * wolo.pl '.' studio
 * 2022
 *
 * 
 * Use:
 *      QConsole.configure({dev: true});
 *      $('#console').QC_makeItAConsole();
 *     // or: // $('#console-wrap').QC_createConsoleInside();
 *
 *     QConsole.log('Log message', someVar, 'warning');
 *     (message, [variable, log level])
 */


/**
 * @requires Utility
 */
let QConsole = {


    //instances: {},
    el: null,

    // -1: not initialized,
    state: -1,

    // global configuration
    config: {},

    dev: false,

    available: false,

    // command line internal use
    cli: {
        // available registered commands and their handlers
        commands: {},
        // history of commands executed
        history: [],
        historyPosition: 0,
    },

    /**
     * Set config, handle incoming json, set defaults (possibly bind some global handlers)
     * @param setup json
     */
    configure: setup => {
        if (typeof setup === 'undefined')
            setup = {};

        QConsole.config = {

                    // todo:
                // don't hide completely when collapsed - stick out a few px bar from
                // under the container edge, to allow to expand by click or other interaction
                // (if can't use keyboard listener to trigger for some reason) 
                    /*showPartiallyWhenCollapsed:     setup?.showPartiallyWhenCollapsed
                                    ??      true,*/

            startState:     setup?.startState
                            ??      'collapsed',

                    // todo:
                        // edge, the console is stuck to (from which side console will roll out)
                    /*expandFrom:     setup?.expandFrom
                                    ??      'top',*/

                // basically, it should be set using css, but we can also enforce that here (if your css customization still allows that)
            expandSize:     setup?.expandSize
                            ??      50,

                    // todo:
                        // number of terminal entries kept in memory/dom, oldest will be truncated if limit hits 
                    /*maxLogItems:     setup?.maxLogItems
                                    ??      512,*/

                // bind default keyboard events (note, you cannot just override one of them, value passed to conf overrides whole conf item)
                // if needed, read the value first and then modify the arr/obj
            bindKeystrokesGlobal:     setup?.bindKeystrokesGlobal
                            ??  {
                                        // ` - open console
                                    192:    (e) => {  QConsole.toggle();  },
                            },

            bindKeystrokesInConsole:     setup?.bindKeystrokesInConsole
                            ??  {
                                        // ` - open console
                                        // todo later: allow entering that char with keyboard, somehow (mod key? or maybe escape symbol?)
                                    192:    (e) => {  QConsole.toggle();  e.preventDefault();     },
                                        // escape - collapse
                                    27:     (e) => {   QConsole.collapse();    }
                            },
        }

        if (setup?.dev)
            QConsole.dev = true;

        QConsole.cliRegisterCommands();
    },


    /**
     * Setup single dom element. In most standard cases it will be only one QC instance in an app, and this method
     * will be called internally when run by .QC_makeItAConsole(). So you don't have to bother.
     * @param el obj instance
     */
    setupInstance: (el) => {
        if (QConsole.el)    {
            return console.warn('setupInstance: Console ALREADY SET! exit');
        }

        let Qel = QConsole.el = $(el);

        // on load::
        // state 0 = collapsed
        QConsole.state = 0;
        if (QConsole.config.startState === 'expanded')  {
            QConsole.state = 1;
            Qel.addClass('expanded');
        }


        // build console
        Qel.addClass('q-console')
            .removeClass('hidden')
            .prop('style', '--qc-size: '+QConsole.config.expandSize)
            .append(
                $('<div class="log-container"></div>   <div class="prompt"> <div class="symbol"></div> <input class="command-line" placeholder="..."> </div>')
            );


        // bind listeners

        // keyboard global
        if (Object.keys(QConsole.config.bindKeystrokesGlobal).length)  {
            $(document).on('keydown', e => {
                // console.log('GLOBAL KEYSTROKE: ', e.keyCode);
                $.each(QConsole.config.bindKeystrokesGlobal, (key, callback) => {
                    if (e.keyCode  ===  parseInt(key)) {     
                        return callback(e);
                    }
                });
            });
        }

        // keyboard internal
        if (Object.keys(QConsole.config.bindKeystrokesInConsole).length)  {
            $(Qel).on('keydown', e => {
                // console.log('INTERNAL CONSOLE KEYSTROKE: ', e.keyCode);
                // omit execution of listeners on higher level (like app's global hotkeys)
                e.stopPropagation();
                $.each(QConsole.config.bindKeystrokesInConsole, (key, callback) => {
                    if (e.keyCode  ===  parseInt(key)) {     
                        return callback(e);
                    }
                });
            });
        }

        // keyboard cli
        Qel.find('.command-line').on('keydown', e => {
            //console.log(e.keyCode);
            if (e.keyCode  ===  38) // cursor UP - previous from history
                return QConsole.cliHistory(e, -1);
            if (e.keyCode  ===  40) // cursor DOWN - next from history
                return QConsole.cliHistory(e, +1);
            if (e.keyCode  ===  13) // enter - try to execute current input value
                return QConsole.cliHandle(e);
        });


        // expand od double click (meant to use when console is in always-partially-visible mode)
        Qel.bind('dblclick', (e) => {
            QConsole.expand();
        });
    },


    /**
     * Trigger plugin self-autoinit. (Runs general setup of all found dom items using (pre)defined selectors)
     * - Usually, it's better to just call $(el).QC_makeItAConsole()
     * 
     * @param selectors Object {
     *      applyTo:        [string] Apply DigitAll
     * }
     */
    initialize: (selectors) => {
        return;
        // todo: think how finally make handling of instances. keeping all here in properties, (currently it only works with one - [probably that's the way it should be])
        // (like php's static class, or singleton) - or instantiate this like new class (prototype?)
        // - where to keep it then? in dom item's props?

        let applyTo = selectors?.applyTo  ||  '#console';

        $(applyTo).each( (i, el) => {
            if (QConsole.dev)   console.info('- auto init QC for selector: '+selectors?.applyTo, el);

            $(el).QConsole_makeItAConsole();
        });
    },

    
    log: (log, data, level) => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        if (!level  ||  (level !== 'log'  &&  level !== 'info'  &&  level !== 'warning'  &&  level !== 'error')) {
            level = 'log';
        }

        // todo: error level
        let backtrace = (new Error().stack).replace(/^Error/, 'Trace:');
        let item;
        if (data)   {
            let dataDump = JSON.stringify(data, null, "\t");
            item = $('<pre class="item level-'+level+'">').text(log + "\n" + (dataDump || '[cannot json.stringify variable]'));
        }
        else    {
            item = $('<div class="item level-'+level+'">').text(log);
        }
        item.attr('title', backtrace);
        

        //let console_custom = $('#console');
        let console_container = QConsole.el.find('.log-container');
        console_container.append(item);
        QConsole.scrollUpdate();
        // todo: option
        if (data)   console.log(log, data)
        else        console.log(log)
    },

    info: (log, data) => {
        this.log(log, data, 'info');
    },
    warning: (log, data) => {
        this.log(log, data, 'warning');
    },
    error: (log, data) => {
        this.log(log, data, 'error');
    },


    expand: () => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        QConsole.el.addClass('expanded');
        QConsole.el.find('.command-line').focus();
        QConsole.state = 1;
    },

    collapse: () => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        QConsole.el.removeClass('expanded');
        QConsole.state = 0;
    },

    /**
     * Toggle visibility state. Not just toggle current classes, but basing on tracked instance state
     */
    toggle: () => {
        if (QConsole.state === 0)    {
            QConsole.expand();
        }
        else if (QConsole.state === 1)    {
            QConsole.collapse();
        }
    },


    /**
     * Scroll overflowed wrapper to the latest item (to the bottom, if used direction=top)
     */
    scrollUpdate: () => {
        let itemContainer = QConsole.el.find('.log-container');
        itemContainer.scrollTop(
            itemContainer.prop('scrollHeight'));
    },


    /**
     * Extra functionality - command line interface
     * @param e Keyboard event (usually enter key)
     */
    cliHandle: (e) => {
        let cliEl = e.currentTarget;
        let cmd = cliEl.value;
        // split cmd line to parts (filter - avoid empty)   // todo: split parameters by quotes first!
        let cmdParts = cmd.split(' ').filter(item => item);
        let command = cmdParts[0];
        let params = cmdParts.slice(1);
        let output;

        // console.log('command: ' + command, params);

        QConsole.cli.history.push(cmd);
        QConsole.cli.historyPosition = QConsole.cli.history.length - 1;

        // call command - exec handler, if registered
        output = {    result: 'command not found',     level: 'error'     };

        if (typeof QConsole.cli.commands[command] === 'function')   {
            output = QConsole.cli.commands[command](params);
        }

        // write cmd call result to console and reset command input text
        QConsole.log("> " + cmd, output.result, output.level ?? 'log');
        cliEl.value = '';
    },

    cliHistory: (e, direction) => {
        direction = Utility.forceNumberInScope(parseInt(direction),-1,1);  // force between -1 and 1, exit when no history or no direction given
        if (!QConsole.cli.history.length || !direction)
            return;
        let cliEl = e.currentTarget;
        // console.log('QConsole.cli.historyPosition:', QConsole.cli.historyPosition);

        // set cli input to historic value
        cliEl.value = QConsole.cli.history[QConsole.cli.historyPosition] ?? '';
        // update current history recall pointer (will reset on another cmd call)
        QConsole.cli.historyPosition += direction;
        // force position - min: -1, max: history.length-1  (min: -1: means it will also show empty as the oldest one. change to 0 to end on the first called command)
        QConsole.cli.historyPosition = Utility.forceNumberInScope(QConsole.cli.historyPosition, -1,QConsole.cli.history.length - 1);
    },

    /**
     * Register command handlers
     * @param customCommands array-object ['cmd': handlerFunc]
     *  (expected handler return value is: {result: mixed, level: string [log|info|warning|error]}
     */
    cliRegisterCommands: (customCommands) => {
        // for external use - register custom commands
        if (customCommands)   {
            $.each(customCommands, (command, handle) => {
                QConsole.cli.commands[command] = handle;
            })
        }
        // setup QConsole default commands
        else    {
            QConsole.cli.commands = {
                'eval': (params) => {
                    console.log('eval - params:', params);
                    if (params.length)  {
                        return {    result: eval(params.join(' ')),     level: 'info'  }
                    }
                    return {    result: 'evaluate error: parameter missed, nothing to execute',     level: 'error'     };
                },

                'qconsole': (params) => {
                    console.log('QConsole - params: ', params);
                    let method = params[0];
                    let methodParams = params.slice(1);
                    console.log(methodParams);
                    if (!method) {
                        return {    result: 'QConsole: no method specified!',    level: 'warning'     };
                    }
                    if (typeof QConsole[method] !== 'function') {
                        return {    result: 'QConsole: cannot find method `'+method+'`',    level: 'error'     };
                    }
                    return {    result: QConsole[method](methodParams.join(' ')), };
                },
            };
        }
    },


    /**
     * Extra functionality - write log nessages to file. Helps when console is hidden for user or unavailable for other reason,
     * like running app in standalone packed exe environment, calls to QConsole log in running code will be dumped to check later.
     * Needs to register filesystem handler first, to use. Like node's 'fs'.
     */
    logToFile: () => {
        // todo later
    },
};




// !! WARNING !! using short syntax doesn't work for $.fn for some reason!
$.fn.extend({

    // init QC on some el
    QC_makeItAConsole: function() {
        let el = this;
        //console.log(el);
        QConsole.setupInstance(el);
    },


    // Append el into this, run .setup then
    QC_createConsoleInside: function() {
        let container = this;
        let el = $('<div class="console">');
        container.append(el);
        QConsole.setupInstance(el);
    },


    // correction of offset position (usually when appending new elements it doesn't scroll to bottom by itself)
    QC_scrollToLatest: function() {
        QConsole.scrollUpdate();
    }

});
// alternative way - also works:
// $.fn.QConsole = function(){
// QConsole: () => {





// test
/*(() => {
    'use strict'

    QConsole.configure({dev: true});
    $('#console').QC_makeItAConsole();
    // or: // $('#console-wrap').QC_createConsoleInside();
    
    //QConsole.initialize({applyTo: '#console'});
    
    QConsole.log('LOG', null, 'log');
    QConsole.log('WARN', null, 'warning');
    QConsole.warning('also WARN');
    QConsole.error('ERROR', null, 'error');
    QConsole.info('INFO', null, 'info');
})()*/
