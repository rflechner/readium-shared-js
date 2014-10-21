//
//  Created by Mickaël Menu.
//  Modified by Juan Corona.
//  Portions adapted from Rangy's Module system: Copyright (c) 2014 Tim Down
//
//  Copyright (c) 2014 Readium Foundation and/or its licensees. All rights reserved.
//
//  Redistribution and use in source and binary forms, with or without modification,
//  are permitted provided that the following conditions are met:
//  1. Redistributions of source code must retain the above copyright notice, this
//  list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice,
//  this list of conditions and the following disclaimer in the documentation and/or
//  other materials provided with the distribution.
//  3. Neither the name of the organization nor the names of its contributors may be
//  used to endorse or promote products derived from this software without specific
//  prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
//  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
//  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
//  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
//  BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
//  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
//  OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
//  OF THE POSSIBILITY OF SUCH DAMAGE.

//
// A lightweight plugins controller used to easily add plugins from the host
// app, eg.
//
//   ReadiumSDK.plugins.load(FootnotePlugin, true);
//
// The controller will create a new instance of the plugin, forwarding any given
// arguments. Then, on several useful common Readium notifications, the
// controller will call predefined callbacks if implemented in the plug-in.
//
// Supported callbacks are:
//      onReaderInitialized()
//      onDocumentLoadStart($iframe, spineItem)
//      onDocumentLoadedBeforeInjection($iframe, $document, spineItem);
//      onDocumentLoaded($iframe, $document, spineItem);
//

function PluginApi(reader, plugin) {
    this.reader = reader;
    this.plugin = plugin;

    this.extendReader = function (extendWith) {
        if (reader.plugins) {
            var obj = {};
            obj[plugin.name] = extendWith;

            _(reader.plugins).extend(obj);
        }
    };
}

function PluginApiFactory(reader) {
    this.create = function (plugin) {
        return new PluginApi(reader, plugin);
    }
}

function PluginsController() {
    var self = this;

    var _plugins = [];

    function _initializePlugins(reader) {
        var plugin,
            apiFactory = new PluginApiFactory(reader);

        if (!reader.plugins) {
            //attach an object to the reader that will be
            // used for plugin namespaces and their extensions
            reader.plugins = {};
        } else {
            throw new Error("Already initialized on reader!");
        }

        for (var pluginName in _plugins) {
            if ((plugin = _plugins[pluginName]) instanceof Plugin) {
                plugin.init(apiFactory);
            }
        }
    }

    function _getExceptionMessage(ex) {
        return ex.message || ex.description || String(ex);
    }

    // Creates a new instance of the given plugin constructor.
    this.loadPlugin = function (name, optDependencies, initFunc) {

        var dependencies;
        if (typeof optDependencies === 'function') {
            initFunc = optDependencies;
        } else {
            dependencies = optDependencies;
        }

        _plugins[name] = new Plugin(name, dependencies, function (plugin, api) {
            if (!plugin.initialized) {
                plugin.initialized = true;
                try {
                    initFunc.call({}, api);
                    plugin.supported = true;
                } catch (ex) {
                    plugin.fail(_getExceptionMessage(ex));
                }
            }
        });
    };

    ReadiumSDK.on(ReadiumSDK.Events.READER_INITIALIZED, function (reader) {

        try {
            _initializePlugins(reader);
        } catch (ex) {
            console.error("Plugins failed to initialize:" + _getExceptionMessage(ex));
        }

        _.defer(function () {
            ReadiumSDK.trigger(ReadiumSDK.Events.PLUGINS_LOADED);
        });
    });
}

ReadiumSDK.Plugins = new PluginsController();

//
//  The following is adapted from Rangy's Module class:
//
//  Copyright (c) 2014 Tim Down
//
//  The MIT License (MIT)
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all
//  copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//  SOFTWARE.

function Plugin(name, dependencies, initializer) {
    this.name = name;
    this.dependencies = dependencies;
    this.initialized = false;
    this.supported = false;
    this.initializer = initializer;
}

Plugin.prototype = {
    init: function (apiFactory) {
        var requiredPluginNames = this.dependencies || [];
        for (var i = 0, len = requiredPluginNames.length, requiredPlugin, PluginName; i < len; ++i) {
            PluginName = requiredPluginNames[i];

            requiredPlugin = Plugins[PluginName];
            if (!requiredPlugin || !(requiredPlugin instanceof Plugin)) {
                throw new Error("required Plugin '" + PluginName + "' not found");
            }

            requiredPlugin.init(apiFactory);

            if (!requiredPlugin.supported) {
                throw new Error("required Plugin '" + PluginName + "' not supported");
            }
        }

        // Now run initializer
        this.initializer(this, apiFactory.create(this));
    },

    fail: function (reason) {
        this.initialized = true;
        this.supported = false;
        throw new Error("Plugin '" + this.name + "' failed to load: " + reason);
    },

    warn: function (msg) {
        console.warn("Plugin " + this.name + ": " + msg);
    },

    deprecationNotice: function (deprecated, replacement) {
        console.warn("DEPRECATED: " + deprecated + " in Plugin " + this.name + "is deprecated. Please use "
            + replacement + " instead");
    },

    createError: function (msg) {
        return new Error("Error in " + this.name + " Plugin: " + msg);
    }
};