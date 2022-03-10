/**
 * QConsole - simple rollout terminal, in classic Quake-style.
 * Can handle many parallel consoles in the same time, ie. to separate your topics and switch to new empty one.
 * (like in ConEmu)
 * 
 * v0.6
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

    DEV: false,

    available: false,

    // command line internal use
    cli: {
        // available registered commands and their handlers
        commands: {},

        // history of commands executed
        history: [],
        historyPosition: 0,

        // whether ac box is now in some prompting action (thus: visible)
        autocompleteIsInAction: false,
        // on cli keyup the ac prompt is activated, but sometimes we use special buttons to navigate it 
        // - in such case, we need to prevent the keyup from running that time
        autocompleteListenerFreeze: false,

        // elements referenced  // todo later: rework to QCInstance object, or something
        el: {
            // command input
            input: null,
            // auto-completion container box for prompt items
            acContainer: null,
            // auto-completion spacer element, for the offset-box-to-caret hack
            acSpacer: null,
        }
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
                                    192:    (e) => {  QConsole.toggle();  e.preventDefault(); },
                            },

            bindKeystrokesInConsole:     setup?.bindKeystrokesInConsole
                            ??  {
                                        // ` - open console
                                        // todo later: allow entering that char with keyboard, somehow (mod key? or maybe escape symbol?)
                                    192:    (e) => {  QConsole.toggle();  e.preventDefault();     },
                                        // escape - collapse
                                    27:     (e) => {   QConsole.collapse();    }
                            },

                // command line auto-completion
            cliAutocomplete:     setup?.cliAutocomplete
                            ??      true,

            cliAcSelectedItemClass:     setup?.cliAcSelectedItemClass
                            ??      'ac-selected',

        }

        if (setup?.dev)
            QConsole.DEV = true;

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

        // on load:
        // state 0 = collapsed
        QConsole.state = 0;

        // create + store instance references
        let Qel = QConsole.el = $(el);
        let cliInput = QConsole.cli.el.input = $('<input class="command" placeholder="...">');
        let acSpacer = QConsole.cli.el.acSpacer = $('<div class="ac-spacer">');
        let acContainer = QConsole.cli.el.acContainer = $('<div class="ac-container">');


        // build console
        Qel.addClass('q-console')
            .removeClass('hidden')
            .prop('style', '--qc-size: '+QConsole.config.expandSize)
            .append(
                $('<div class="log-container"></div>'),
                $('<div class="cli">').append(
                        $('<div class="prompt"></div>'),
                        $('<div class="command-line">').append(
                                cliInput,
                                $('<div class="autocomplete">').append(
                                        acSpacer,
                                        acContainer,
                                )
                        )
                )
            );


        // open on start, if requested to
        if (QConsole.config.startState === 'expanded')  {
            QConsole.state = 1;
            Qel.addClass('expanded');
            cliInput.focus();
        }


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

            Qel.on('keydown', e => {
                if (App.DEBUG > 1)   console.log('INTERNAL CONSOLE KEYSTROKE: ', e.keyCode);
                // omit execution of listeners on higher level (like app's global hotkeys)
                e.stopPropagation();
                $.each(QConsole.config.bindKeystrokesInConsole, (key, callback) => {
                    if (e.keyCode  ===  parseInt(key)) {     
                        return callback(e);
                    }
                });
            });
        }

        // keyboard cli (separated)
        cliInput.on('keydown', e => {
            // console.log(e.keyCode);

            QConsole.cli.autocompleteListenerFreeze = false;

            // if autocomplete prompt is active and visible, overrule some of keypresses listeners (to prompt navigation) 
            if (QConsole.cliAcIsActive())    {
                    if (App.DEBUG > 1)  console.log('INTERNAL CONSOLE KEYSTROKE AUTOCOMPLETE: ', e.keyCode);

                    e.stopPropagation();
                    QConsole.cli.autocompleteListenerFreeze = true;

                    if (e.keyCode  ===  38) // cursor UP - previous item
                        return QConsole.cliAcNavigatePrompt(e, -1);
                    if (e.keyCode  ===  40) // cursor DOWN - next item
                        return QConsole.cliAcNavigatePrompt(e, +1);
                    if (e.keyCode  ===  13) // ENTER - confirm
                        return QConsole.cliAcNavigatePrompt(e, true);
                    if (e.keyCode  ===  9) // TAB - confirm
                        return QConsole.cliAcNavigatePrompt(e, true);
                    if (e.keyCode  ===  27) // ESC - dismiss
                        return QConsole.cliAcNavigatePrompt(e, false);
                    //if (e.keyCode  ===  8  &&  )  // backspace -

                    // if we still here, set to normal operation (that way prevents making another mess) 
                    QConsole.cli.autocompleteListenerFreeze = false;
            }

            // otherwise - normal cli behaviour
            else    {
                    if (App.DEBUG > 1)  console.log('INTERNAL CONSOLE KEYSTROKE CLI: ', e.keyCode);

                    if (e.keyCode  ===  38) // cursor UP - previous from history
                        return QConsole.cliInputHistory(e, -1);
                    if (e.keyCode  ===  40) // cursor DOWN - next from history
                        return QConsole.cliInputHistory(e, +1);
                    if (e.keyCode  ===  13) // enter - handle current input value
                        return QConsole.cliHandleSubmit(e);
            }
        })
        .on('keyup', e => {

            if (QConsole.config.cliAutocomplete  &&  ! QConsole.cli.autocompleteListenerFreeze)  {
                    //console.log(e.keyCode);
                    // let cliInput = e.currentTarget;
                    let cliInput = QConsole.cli.el.input[0];
                    let cmdLine = cliInput.value;

                    QConsole.cliAutocomplete(cmdLine);
            }
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
            if (QConsole.DEV)   console.info('- auto init QC for selector: '+selectors?.applyTo, el);

            $(el).QConsole_makeItAConsole();
        });
    },


    /**
     * Write some text output to QConsole (does not send it to devtools!)
     * @param msg string
     * @param level ?string
     */
    write: (msg, level) => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        if (!level  ||  (level !== 'log'  &&  level !== 'info'  &&  level !== 'warning'  &&  level !== 'error')) {
            level = 'log';
        }

        let item;
            item = $('<pre class="item  item-write  level-'+level+'">').text(msg);
        //item.attr('title', '');

        let console_container = QConsole.el.find('.log-container');
        console_container.append(item);
        QConsole.scrollUpdate();
    },


    /**
     * 
     * @param log string
     * @param data mixed
     * @param level ?string
     */
    log: (log, data, level) => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        if (!level  ||  (level !== 'log'  &&  level !== 'info'  &&  level !== 'warning'  &&  level !== 'error')) {
            level = 'log';
        }

        let backtrace = (new Error().stack).replace(/^Error/, 'Trace:');
        let item;
        if (data)   {
            let dataDump;
            switch (typeof data)    {
                case 'object':
                    dataDump = JSON.stringify(data, null, "\t");
                    break;
                default:
                    dataDump = data.toString();
            }
            item = $('<pre class="item  item-log  with-data  level-'+level+'">').text(log + "\n" + (dataDump || '[cannot json.stringify variable]'));
        }
        else    {
            item = $('<div class="item  item-log  without-data  level-'+level+'">').text(log);
        }
        item.attr('title', backtrace);
        

        let console_container = QConsole.el.find('.log-container');
        console_container.append(item);
        QConsole.scrollUpdate();
        // todo: option in settings - whether to call console.logs here
        if (data)   console.log(log, data)
        else        console.log(log)
    },

    info: (log, data) => {
        QConsole.log(log, data, 'info');
    },
    warning: (log, data) => {
        QConsole.log(log, data, 'warning');
    },
    error: (log, data) => {
        QConsole.log(log, data, 'error');
    },


    expand: () => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        QConsole.el.addClass('expanded');
        QConsole.cli.el.input.focus();
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
     * Command Line Interface - handle input/submit
     * @param e Keyboard event (usually enter key)
     * @protected
     */
    cliHandleSubmit: (e) => {
        //let cliInput = e.currentTarget;
        let cliInput = QConsole.cli.el.input[0];
        let acSpacer = QConsole.cli.el.acSpacer[0];
        let cmdLine = cliInput.value;

        QConsole.cliExec(cmdLine);

        // reset command input text (and synced values)
        QConsole.cliValueSet('');
    },



    /**
     * Command Line Interface - parse a line of user input
     * @param cmdLine string
     * @protected
     */
    cliParse: (cmdLine) => {
        // split cmd line to parts (filter - avoid empty)
        let cmdParts = cmdLine.split(/("[^"]+"|[^\s"]+)/gmiu).filter(i => i.trim());
        let command = cmdParts[0]?.toLowerCase();
        let params = cmdParts.slice(1);
        // console.log('command: ' + command, params);
        return  {
            command: command,
            params: params,
        }
    },


    /**
     * Command Line Interface - validate and execute command (if registered in QConsole.cli.commands)
     * @param cmdLine string Command line input
     */
    cliExec: (cmdLine) => {
        cmdLine = cmdLine.trim();

        let parsed = QConsole.cliParse(cmdLine),
            command = parsed.command,
            params = parsed.params;

        QConsole.cli.history.push(cmdLine);
        QConsole.cli.historyPosition = QConsole.cli.history.length - 1;

        let output = {
            result: 'command not found',
            level: 'error',
        };

        if (typeof QConsole.cli.commands[command]?.callable === 'function')   {
            output = QConsole.cli.commands[command].callable(params);
        }

        // write cmd call result to console
        if (typeof output.result === 'string')  {
            QConsole.write("> " + cmdLine +"\n"+ output.result, output.level ?? 'log');
        }
        else    {
            QConsole.log("> " + cmdLine, output.result, output.level ?? 'log');
        }

        return output;
    },


    /**
     * For use in CLI callables. Provides standard check and returns standard output
     * @param code string
     * @protected
     */
    cliEvalCode: (code) => {
        let output = {result: null, level: 'info'}
        try {
            console.log('- evaluate code: ', code);
            output.result = eval(code);
        } catch (e) {
            output.result = e.message;  // e.stack - more details
            output.level = 'error';
        }
        return output;
    },


    cliInputHistory: (e, direction) => {
        e.preventDefault();
        direction = Utility.forceNumberInScope(parseInt(direction),-1,1);  // force between -1 and 1, exit when no history or no direction given
        if (!QConsole.cli.history.length || !direction)
            return;
        let cliInput = e.currentTarget;
        // console.log('QConsole.cli.historyPosition:', QConsole.cli.historyPosition);

        // set cli input to historic value
        cliInput.value = QConsole.cli.history[QConsole.cli.historyPosition] ?? '';
        // update current history recall pointer (will reset on another cmd call)
        QConsole.cli.historyPosition += direction;
        // force position - min: -1, max: history.length-1  (min: -1: means it will also show empty as the oldest one. change to 0 to end on the first called command)
        QConsole.cli.historyPosition = Utility.forceNumberInScope(QConsole.cli.historyPosition, -1,QConsole.cli.history.length - 1);
    },

    /**
     * Register command handlers
     * @param commands array-object ['cmd':
     *  title: string 
     *  syntax: string
     *  description: string
     *  callable: function
     * ]
     *  (expected handler return value is: {result: string, level: string [log|info|warning|error]}
     */
    cliRegisterCommands: (commands) => {
        // for external use - register custom commands
        if (commands)   {
            $.each(commands, (cmd, handleConf) => {
                QConsole.cli.commands[cmd.toLowerCase()] = handleConf;
            });
            // sort alphabetically
            QConsole.cli.commands = Object.fromEntries(Object.entries(QConsole.cli.commands).sort());
        }
        // internal - setup QConsole default commands
        else    {
            let defaultCommands = {
                // commands are toLowerCase-d on register and when executed. (only the command itself, not the whole line) 
                'help': {
                        title: 'Commands reference',
                        syntax: 'help [COMMAND]',
                        description: 'Show console command(s) informations',
                        callable: (params) => {
                            let result = '';
                            let level = 'info';
                            console.log('help - params:', params);
                            //console.log(QConsole.cli.commands);

                            // display help only for passed command
                            if (params[0])  {
                                let cmd = params[0];
                                let conf = QConsole.cli.commands[cmd];
                                if (conf)   {
                                    result = "\n"+ cmd
                                             +"\n    "+ conf.title
                                             +"\n    Syntax: "+ conf.syntax
                                             +"\n    "+ conf.description;
                                }
                                else {
                                    result = 'Command '+ cmd +' is not registered'; 
                                    level = 'error';
                                }
                            }
                            // full help
                            else    {
                                result = 'Available commands:';
                                $.each(QConsole.cli.commands, (cmd, conf) => {
                                    if (conf.title  ||  App.DEV) {
                                        result += "\n\n  "+ conf.syntax
                                                 +"\n    "+ conf.title;
                                    }
                                });
                            }
                            return {    result: result,     level: level     };
                        },
                },

                'eval': {   // todo later: restrict to DEV
                        title: 'Run JS code',
                        syntax: 'eval CODE',
                        description: 'Evaluate JavaScript expression \'CODE\'',
                        callable: (params) => {
                            console.log('eval - params:', params);
                            if (params.length)  {
                                return {    result: eval(params.join(' ')),     level: 'info'  }
                            }
                            return {    result: 'evaluate error: parameter missed, nothing to execute',     level: 'error'     };
                        },
                },

                'qconsole': {
                        title: 'Call object method',
                        syntax: 'QConsole METHOD [PARAM]...',
                        description: 'Call QConsole.METHOD([PARAM]...)',
                        callable: (params) => {
                            let objName = 'QConsole';
                            let method = params[0];
                            let methodParams = params.slice(1);
                            //console.log(objName+' - params: ', params);
                            console.log(methodParams);
                            // todo: when ready, take-out changes from 'xplayer' object-method command, use cliEvalCode as well
                            if (!method) {
                                return {    result: objName+': no method specified!',    level: 'warning'     };
                            }
                            // note, that method name is case sensitive!
                            if (typeof Xplayer[method] !== 'function') {
                                return {    result: objName+': cannot find method `'+method+'`',    level: 'error'     };
                            }
                            let evalCode = objName+'.' +method+'('+ methodParams.join(', ') + ')';
                            return QConsole.cliEvalCode(evalCode);
                        },
                },

                'version': {
                        title: 'App version',
                        syntax: 'version',
                        description: 'Print application version info',
                        callable: (params) => {
                            // todo: add components / libs versions (+ node?)
                            return {    result: 'App: '+App.VERSION,     level: 'info'     };
                        },
                },
            };

            //console.log(QConsole.DEV);
            // todo later: restrict to DEV. the problem is, it starts before any App.DEV or config value is set. how to handle that?
            //if (QConsole.DEV)   {
                defaultCommands['debug'] = {
                        title: 'Debug QConsole CLI',
                        syntax: 'debug',
                        description: 'Output CLI full config',
                        callable: (params) => {
                            //QConsole.log('QConsole CLI debug: ', QConsole.cli);
                            //return {    result: 'QConsole CLI : see devtools',     level: 'info'  }
                            return {    result: QConsole.cli,     level: 'info'  }
                        },
                };
            //}
            QConsole.cliRegisterCommands(defaultCommands);
        }
    },


    cliAutocomplete: (cmdLine) => {
        if (!QConsole.el)    {
            return console.error('QConsole Not initialized? Instance $el not set');
        }
        // reset / cleanup each time and build new set (must be before validation, to remove box on cmd empty)
        QConsole.cliAcDeactivate();

        cmdLine = cmdLine.toLowerCase();
        if (!cmdLine.trim())   {
            return;
        }

        let selectedItemClass = QConsole.config.cliAcSelectedItemClass;
        let acContainer = QConsole.cli.el.acContainer[0];
        let acSpacer = QConsole.cli.el.acSpacer[0];
        let cliInput = QConsole.cli.el.input[0];
        let completionItemsCount = 0;
        // declaring here we will get the last item in this var, so we can later mark it
        let acItem = null;

        // set the same text value to the special spacer block hidden under the input (offset-resizer) 
        //  - this will allow to calculate the offset finally (or position stacking float on it)
        // acSpacer.innerText = cmdLine;
        QConsole.cliValueSet(cmdLine);  // check if we can set the input val here, or it complicates something
            // luckily, with current styles it aligns automatically, but if in future it stops - use that offset
            // let caretOffset = acSpacer.offsetWidth;


        // build the autocompletion-items and add to ac container
        let addItem = (conf) => {
            acItem = document.createElement('div');
                acItem.classList.add('ac-item');
            const _command = document.createElement('div');
                _command.classList.add('ac-cmd');
                _command.innerText = conf.commandDetails;
            const _completion = document.createElement('div')
                _completion.innerText = conf.completionPart;
                _completion.classList.add('ac-completion');

            acItem.appendChild(_command);
            acItem.appendChild(_completion);
            acContainer.appendChild(acItem);
            completionItemsCount++;


            acItem.addEventListener('click', (e) => {
                cliInput.value = conf.command;
                acSpacer.innerText = conf.command;

                // auto-completion chosen - set value, job done for now - deactivate promptbox
                QConsole.cliAcDeactivate()
            });
        };


        // search for the string in keys and collect completion propositions 
        $.each(QConsole.cli.commands, (command, handleConf) => {
            let cmdNameMatchPos = command.indexOf(cmdLine);
            // take these with match on pos 0 (begins with input str), exit if it's complete
            if (cmdNameMatchPos === 0  &&  cmdLine !== command)   {

                addItem({
                    command: command,
                    commandDetails: '> ' + (handleConf?.syntax ?? command)
                            + (handleConf?.title  ?  '  -  '+handleConf.title  :  ''),
                    completionPart: command.split(cmdLine, 2)[1] ?? '',
                })
            }
        });

        // if any prompt completion items was built
        if (completionItemsCount)   {
            // set the selected class to the last item
            acItem?.classList.add(selectedItemClass);
            // set the auto-completion is active (selector visible and navigable) - that changes some behaviour
            QConsole.cliAcActivate();
        }
    },


    cliAcReset: () => {
        let acContainer = QConsole.cli.el.acContainer[0];
        acContainer.replaceChildren();
    },

    cliAcDeactivate: () => {
        QConsole.cli.autocompleteIsInAction = false;
        QConsole.cliAcReset();
    },

    cliAcActivate: () => {
        QConsole.cli.autocompleteIsInAction = true;
    },


    cliAcIsActive: () => {
        return !! QConsole.cli?.autocompleteIsInAction;
    },

    /**
     * Use this to update/reset current cli value - to keep always in sync both values (real and offset-trick)
     * Also - replaces spaces with underscores for the hidden input, to not being ignored 
     * @param cmdLine
     */
    cliValueSet: (cmdLine) => {
        // let acContainer = QConsole.cli.el.acContainer[0];
        let cliInput = QConsole.cli.el.input[0];
        let acSpacer = QConsole.cli.el.acSpacer[0];

        cliInput.value = cmdLine;
        acSpacer.innerText = cmdLine.replaceAll(' ', '_');
    },

    /**
     * Handle autocomplete prompt navigation
     * @param e Event
     * @param value integer|boolean
     */
    cliAcNavigatePrompt: (e, value) => {

        e.preventDefault();

        let selectedItemClass = QConsole.config.cliAcSelectedItemClass;
        let acContainer = QConsole.cli.el.acContainer[0];
        //let acSpacer = QConsole.cli.el.acSpacer[0];


        if (typeof value === 'boolean') {
            switch (value)  {

                case true:
                        console.log('- CONFIRM SELECTION');
                        $(acContainer).find('.ac-item.'+selectedItemClass)
                            .click();
                        break;
                default:
                        console.log('- DISMISS AC');
                        QConsole.cliAcDeactivate();
                        break;
            }
        }
        else if (typeof value === 'number')  {

            // navigate / jump through ac items
            console.log('NAVIGATE UP / DOWN', value);
            value = Utility.forceNumberInScope(value, -1, 1);

            // try to find a selected item, if any
            let acItems = $(acContainer).find('.ac-item');
            let acSelectedIndex = 0;
            let acSelectNewIndex = 0;    // i think it should default to 0 to ensure no errors

            if (!acItems.length)
                return; // this should never happen, if we got here they must have been existing right before

            acItems.each( (i, item) => {
                //console.log('i: '+i, item);
                if (item.classList.contains(selectedItemClass)) {
                    // unmark current
                    item.classList.remove(selectedItemClass);
                    // calculate the new index
                    acSelectedIndex = i;
                    acSelectNewIndex = acSelectedIndex + value;

                    if (acSelectNewIndex  >  acItems.length - 1)  {
                        // new index exceeded array size - start over from first
                        acSelectNewIndex -= acItems.length;
                    }
                    if (acSelectNewIndex  <  0) {
                        // new index is negative - start from the last item
                        acSelectNewIndex = acItems.length + acSelectNewIndex;
                    }

                    return acSelectNewIndex;
                }
            });

            // mark as selected the last one set to this var
            acItems[acSelectNewIndex].classList.add(selectedItemClass);
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
