
/*window.app = _.extend(Object.create(Backbone.Events), {
			launch: function() {
				console.warn('launch');
			}
		});*/

_.mixin({
	deepExtend: function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(true);
		return jQuery.extend.apply(this, args);
	},
	resolve : function(path, base, separator) {
		var parts = path.split('.' || separator),
			key = parts.pop();
			base = base || window;

		while (parts.length) {
			part = parts.shift();
			base = base[part] = base[part] || {};
		}
		base[key] = base[key] || {};

		return base[key];
}});

(function(){

  // Initial Setup
  // -------------

  // Save a reference to the global object (`window` in the browser, `global`
  // on the server).
  var root = this;

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to slice/splice.
  var slice = Array.prototype.slice;
  var splice = Array.prototype.splice;

  // The top-level namespace. All public Backbone classes and modules will
  // be attached to this. Exported for both CommonJS and the browser.
  var Helium;
  if (typeof exports !== 'undefined') {
	Helium = exports;
  } else {
	Helium = root.Helium = {};
  }

  // Shared empty constructor function to aid in prototype-chain creation.
  var ctor = function(){};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var inherits = function(parent, protoProps, staticProps) {
	var child;

	// The constructor function for the new subclass is either defined by you
	// (the "constructor" property in your `extend` definition), or defaulted
	// by us to simply call the parent's constructor.
	if (protoProps && protoProps.hasOwnProperty('constructor')) {
	  child = protoProps.constructor;
	} else {
	  child = function(){ parent.apply(this, arguments); };
	}

	// Inherit class (static) properties from parent.
	_.extend(child, parent);

	// Set the prototype chain to inherit from `parent`, without calling
	// `parent`'s constructor function.
	ctor.prototype = parent.prototype;
	child.prototype = new ctor();

	// Add prototype properties (instance properties) to the subclass,
	// if supplied.
	if (protoProps) _.extend(child.prototype, protoProps);

	// Add static properties to the constructor function, if supplied.
	if (staticProps) _.extend(child, staticProps);

	// Correctly set child's `prototype.constructor`.
	child.prototype.constructor = child;

	// Set a convenience property in case the parent's prototype is needed later.
	child.__super__ = parent.prototype;

	return child;
  };

  // The self-propagating extend function that Backbone classes use.
  var extend = function (protoProps, classProps) {
	var child = inherits(this, protoProps, classProps);
	child.extend = this.extend;
	return child;
  };

	Helium.Events = function() {
		this.initialize.apply(this, arguments);
	};
	_.extend(Helium.Events.prototype, Backbone.Events, {
		initialize: function() {}
	});
	Helium.Events.extend = extend;

	Helium.define = function(className, data, staticProps) {

		var base = window,
			parent = data.extend || function() {},
			namespace = data.namespace || null;

		if(namespace) {
			base = _.resolve(namespace);
		}

		if(_.isString(parent)) {
			parent = _.resolve(parent);
			if(_.isEmpty(parent)) throw 'Helium has not found extended class "' + data.extend + '".';
		}

		var parts = className.split('.'),
			key = parts.pop();
		while (parts.length) {
			part = parts.shift();
			base = base[part] = base[part] || {};
		}

		delete data.extend;
		delete data.parent;
		delete data.namespace;

		// Extend prototype
		var protoProps = {
			$className: className,
			$namespace: namespace,
			callParent: function(method) {
				var _method = data.callParent.caller;
				method = method || 'constructor';
				base[key].__super__[method].call(this);
			},
			is: function(className) {
				//console.warn(data.$className, this.$className);
				return className == this.$className;
			}
		};

		// Merge configuration from parent
		if(parent.prototype && parent.prototype.config) data.config = _.extend({}, _.clone(parent.prototype.config), data.config || {});

		if(_.isFunction(parent.extend)) base[key] = parent.extend(_.extend(data, protoProps), staticProps);
		else base[key] = _.extend({}, data, protoProps);
	};

	Helium.create = function(className, data) {
		var classObject = _.resolve(className);
		if(_.isEmpty(classObject)) throw 'Helium has not found created class "' + className + '".';
		return new classObject(data);
		//return Object.create(classObject, data);
	};

	Helium.getDisplayName = function(callee) {
		//console.warn(arguments.callee.caller.prototype);
		var methodName = 'anonymous'; //_.find(callee.prototype, function(v, k) { if(v == callee) { methodName = k; return true; }});
		return callee.prototype.$namespace + '.' + callee.prototype.$className + '::' + methodName + '()';
	};
/*
// This code is intentionally inlined for the least amount of debugger stepping
            return (method = this.callParent.caller)
            && (method.$previous ||((method = method.$owner ? method : method.caller) && method.$owner.superclass.$class[method.$name])).apply(this, args || noArgs);*/

}).call(this);

Helium.define('Application', {
	namespace: 'Helium',
	extend: 'Helium.Events',
	routers: [],
	collections: [],
	viewportEl: 'body',
	constructor: function() {
		_.bindAll(this, 'onError', 'onRender', 'onSubmit');
		this.on('error', this.onError);

		this.viewport = Helium.create('Helium.Viewport', {el: this.viewportEl});
	},
	launch: function() {
		var self = this;

		this._collections = _.clone(this.collections);
		this.collections = {};
		_.each(this._collections, function(v) {
			var Collection = _.resolve(self.$namespace + '.collections.' + v);
			self.collections[v] = new Collection();
		});

		this._routers = _.clone(this.routers);
		this.routers = {};
		_.each(this._routers, function(v) {
			var Router = _.resolve(self.$namespace + '.routers.' + v);
			self.routers[v] = new Router();
		});

		this.getViewport().on({render: this.onRender}).render();

	},
	getViewport: function() {
		return this.viewport;
	},
	getCollection: function(className) {
		return this.collections[className];
	},
	getCollectionClass: function(className) {
		if(_.str.include(className, '.')) {
			return _.resolve(className);
		}
		return window[this.$namespace].collections[className];
	},
	getViewClass: function(className) {
		if(_.str.include(className, '.')) {
			return _.resolve(className);
		}
		return window[this.$namespace].views[className];
	},
	getModelClass: function(className) {
		if(_.str.include(className, '.')) {
			return _.resolve(className);
		}
		return window[this.$namespace].models[className];
	},
	onRender: function() {},
	onSubmit: function() {},
	onError: function() {
		console.error(this.$className + '::onError()', arguments);
	}
});

Helium.define('Component', {
	namespace: 'Helium',
	extend: 'Backbone.View',
	config: {},
	templateOptions: {},
	compiledTemplate: null,
	//templateDefaults: {},
	constructor: function() {
		// Protecting object new params
		this.config = _.clone(this.config);
		this.attributes = _.clone(this.attributes);
		this.templateOptions = _.clone(this.templateOptions);
		//this.compiledTemplate = _.clone(this.compiledTemplate);
		//this.templateDefaults = _.clone(this.templateDefaults);
		Helium.Component.__super__.constructor.apply(this, arguments);
	},
	initialize: function() {
		//console.warn(this.$className + '::initialize().config,options', [_.clone(this.config), _.clone(this.options)]);
		Helium.Component.__super__.initialize.apply(this, arguments);

		// Support template override
		if(this.options.template) {
			this.template = _.clone(this.options.template);
		}
		// Extend templateOptions
		if(this.options.templateOptions) {
			this.templateOptions = _.deepExtend({}, this.templateOptions, this.options.templateOptions);
			delete this.options.templateOptions;
		}

		// Bind render to this
		_.bindAll(this, 'render', 'on', 'off');

		// Compile template
		this._compiledTemplate = this.compileTemplate();

		// Extend config with options
		this.config = _.extend(this.config, this.options);
	},
	on: function(eventMap) {
		if(_.isString(eventMap)) {
			return Helium.Component.__super__.on.apply(this, arguments);
		}
		_.each(eventMap, function(v, k) {
			Helium.Component.__super__.on.apply(this, [k, v]);
		}, this);
		return this;
	},
	off: function(eventMap) {
		if(_.isString(eventMap)) {
			return Helium.Component.__super__.off.apply(this, arguments);
		}
		_.each(eventMap, function(v) {
			Helium.Component.__super__.off.apply(this, [v]);
		}, this);
		return this;
	},
	$on: function(eventMap) {
		this.events = _.extend(this.events, eventMap);
		/*if(_.isString(eventMap)) {
			return Helium.Component.__super__.on.apply(this, arguments);
		}
		var parts;
		_.each(eventMap, function(v, k) {
			parts = k.split(' ');
			if(parts.length == 1) parts[1] = null;
			this.$el.on(parts[0], parts[1], v);
		}, this);*/
		return this;
	},
	$off: function(eventMap) {
		/*if(_.isString(eventMap)) {
			return Helium.Component.__super__.on.apply(this, arguments);
		}*/
		var parts;
		_.each(eventMap, function(v) {
			parts = v.split(' ');
			if(parts.length == 1) parts[1] = null;
			this.$el.off(parts[0], parts[1]);
		}, this);
		return this;
	},
	setId: function(id) {
		this.id = id;
		this.$el.attr('id', id);
	},
	compileTemplate: function(template) {
		return Helium.Component.compileTemplate(template || this.template);
	},
	buildTemplate: function(options, compiledTemplate) {
		compiledTemplate = compiledTemplate || this._compiledTemplate;
		if(!compiledTemplate) return null;

		//console.warn('templateoptions', [_.extend({}, this.config, this.templateOptions, options)]);
		var built = compiledTemplate(_.extend({}, this.config, this.templateOptions, options));
		//console.warn('built', built);
		return built;
	},
	render: function(options, silent) {
		Helium.Component.__super__.render.apply(this, arguments);
		//console.warn('-> Rendering base component for class=%o with template=%o', this.$className, _.clone(this.template));

		// Handle template & reset content
		if(!_.isEmpty(this.template)) this.$el.html(this.buildTemplate(options));
		else this.$el.html('');

		// Set classes
		if(!_.isEmpty(this.config.baseCls)) this.$el.addClass(this.config.baseCls);
		if(!_.isEmpty(this.config.cls)) this.$el.addClass(this.config.cls);

		// Set style
		if(!_.isEmpty(this.config.style)) this.$el.attr('style', this.config.style);

		if(!silent) {
			this.trigger('render');
		}

		return this;
	}
}, {
	compileTemplate: function(template) {
		if(!template) return false;

		var compiled;
		if(_.isFunction(template)) {
			compiled = template;
		} else if(_.isString(template)) {
			if(window.Handlebars) {
				if(template[0] == '#') {
					// Use cached version if available
					Handlebars.compiledTemplates = Handlebars.compiledTemplates || {};
					if(Handlebars.compiledTemplates[template]) compiled = Handlebars.compiledTemplates[template];
					else Handlebars.compiledTemplates[template] = compiled = Handlebars.compile($(template).html());
				} else {
					compiled = Handlebars.compile(template);
				}
			} else if(window.Mustache) {
				if(template[0] == '#') {
					compiled = ich[template.substring(1)];
				} else {
					compiled = function(options) { return Mustache.render(template, options); };
				}
			} else {
				throw 'Helium did not found either Handlebars or Mustache to compile templates.';
			}
		}

		return compiled;
	}
});

Helium.define('Container', {
	namespace: 'Helium',
	extend: 'Helium.Component',
	items: [],
	constructor: function() {
		// Protecting object new params
		this.items = _.clone(this.items);
		Helium.Container.__super__.constructor.apply(this, arguments);
	},
	initialize: function() {
		Helium.Container.__super__.initialize.apply(this, arguments);
		if(this.config.items) this.add(this.config.items);

		//_.bindAll(this, 'added');
		//this.on('added', this.added);
	},
	add: function(items, render) {
		if(!_.isArray(items)) items = [items];
		_.each(items, function(item, key) {
			if(!_.isEmpty(item.html)) {
				this.items.push({
					render: function(){return this;},
					is: function(){},
					delegateEvents: function(){},
					el: item.html,
					$el: $(item.html)
				});
			} else if(!_.isEmpty(item.object)) {
				var object = item.object,
					objectClass = _.resolve(object);
				delete item.object;
				if(_.isEmpty(objectClass)) throw 'Can\'t find class '+object;
				var newItem = new objectClass(item);
				this.items.push(newItem);
				// Render added item
				if(render) {
					this.$el.append(newItem.render().$el);
				}
			}
		}, this);
		if(items.length) this.trigger('added', items);
	},
	getItems: function() {
		return this.items;
	},
	setActiveItem: function(item) {
		if(!item) return false;

		var activePanel = _.find(this.getItems(), function(v, k) {
			return v.$el.hasClass('panel active');
		});

		if(_.isString(item)) {
			if(item[0] == '#') {

				var targetPanel = _.find(this.getItems(), function(v, k) {
					return v.$el.hasClass('panel') && v.id == item.substring(1);
				});

				if(!targetPanel) {
					return false;
				} else if(!activePanel) {
					targetPanel.$el.fadeIn(125).addClass('active');
				} else if(activePanel.cid != targetPanel.cid) {
					activePanel.$el.fadeOut(125, function() {
						targetPanel.$el.fadeIn(125).addClass('active');
					}).removeClass('active');
					//activePanel.$el.addClass('animated fadeOutDown').removeClass('active').css({display:'none'});
					//+targetPanel.$el.addClass('active').css({display:'block'}).addClass('animated fadeInDown');
				}
			}
		}
	},
	render: function(options, silent) {
		Helium.Container.__super__.render.apply(this, [options, true]);
		//console.warn('-> Rendering contained items for class=%o with items=%o', this.$className, _.clone(this.items));

		// Render subViews
		_.each(this.items, function(item, k) {
			this.$el.append(item.render().$el);
			item.delegateEvents();
		}, this);

		if(!silent) {
			this.trigger('render');
		}

		return this;
	}
});

Helium.define('Panel', {
	namespace: 'Helium',
	extend: 'Helium.Container',
	tagName: 'div',
	config: {
		baseCls: 'panel',
		style: 'display:none;'
	},
	initialize: function() {
		Helium.Panel.__super__.initialize.apply(this, arguments);
	}
});

Helium.define('Viewport', {
	namespace: 'Helium',
	extend: 'Helium.Container',
	el: 'body',
	config: {
		baseCls: 'viewport'
	},
	initialize: function() {
		Helium.Viewport.__super__.initialize.apply(this, arguments);
	},
	add: function(items, render) {
		// Auto-render items added to the viewport
		//if(_.isUndefined(render)) render = true;
		Helium.Viewport.__super__.add.apply(this, [items, render]);
		/*if(this.getItems().length == items.length) {
			this.getItems()[0].$el.addClass('active').css({display: 'block'});
		}*/
	}
});

Helium.define('Toolbar', {
	namespace: 'Helium',
	extend: 'Helium.Container',
	tagName: 'div',
	config: {
		baseCls: 'toolbar'
	},
	initialize: function() {
		Helium.Toolbar.__super__.initialize.apply(this, arguments);
	}
});

Helium.define('Button', {
	namespace: 'Helium',
	extend: 'Helium.Component',
	tagName: 'div',
	config: {
		baseCls: 'btn'
	},
	initialize: function() {
		Helium.Button.__super__.initialize.apply(this, arguments);
	},
	render: function() {
		Helium.Button.__super__.render.apply(this, arguments);
		if(this.config.icon) {
			this.$el.append(this.make('i', {'class': 'icon-' + this.config.icon})).append(' ');
		}
		if(this.config.text) {
			this.$el.append(this.config.text);
		}
		if(this.config.align) {
			this.$el.css('float', this.config.align);
		}
		return this;
	}
});

Helium.define('Button', {
	namespace: 'Helium.form',
	extend: 'Helium.Component',
	tagName: 'input',
	attributes: {
		type: 'button'
	},
	config: {
		baseCls: 'btn'
	},
	constructor: function() {
		Helium.Button.__super__.constructor.apply(this, arguments);

		if(this.options.type) {
			this.attributes.type = this.options.type;
		}
	},
	initialize: function() {
		Helium.Button.__super__.initialize.apply(this, arguments);
		if(this.config.value) {
			this.setValue(this.config.value);
		}

	},
	setValue: function(value) {
		return this.$el.val(value);
	}
});

Helium.define('DataView', {
	namespace: 'Helium.dataview',
	extend: 'Helium.Container',
	tagName: 'div',
	itemTemplate: '',
	config: {
		baseCls: 'data-view'
	},
	constructor: function() {
		Helium.dataview.DataView.__super__.constructor.apply(this, arguments);

		// Protecting object new params
		this.itemTemplate = _.clone(this.itemTemplate);
	},
	initialize: function() {
		Helium.dataview.DataView.__super__.initialize.apply(this, arguments);
		//console.warn(this.$className + '::initialize().config,options', [_.clone(this.config), _.clone(this.options)]);

		// Compile itemTemplate
		this._compiledItemTemplate = this.compileTemplate(this.itemTemplate);

		// Render dataview when associated collection is fetched - should be changed?
		this.collection.on('fetched', this.render);
	},
	render: function(options, silent) {
		Helium.dataview.DataView.__super__.render.apply(this, [options, true]);

		var htmlBuffer = '';
		this.collection.each(function(v, k) {
			htmlBuffer += this._compiledItemTemplate(_.extend({}, this.templateOptions, v.attributes));
		}, this);
		this.$el.append(htmlBuffer);

		if(!silent) {
			this.trigger('render');
		}

		return this;
	}
});

Helium.define('DataItem', {
	namespace: 'Helium.dataview.component',
	extend: 'Helium.Component',
	tagName: 'div',
	model: {},
	config: {
		baseCls: 'data-item'
	},
	initialize: function() {
		Helium.dataview.component.DataItem.__super__.initialize.apply(this, arguments);

		// Render DataItem when associated model is changed
		//this.model.on('change', this.render);
	},
	render: function(options, silent) {
		Helium.dataview.component.DataItem.__super__.render.apply(this, [_.extend({}, this.model.attributes, options), silent]);
		return this;
	}
});

Helium.define('DataTable', {
	namespace: 'Helium.dataview',
	extend: 'Helium.dataview.DataView',
	tagName: 'table',
	template: '<thead></thead><tbody></tbody>',
	itemTemplate: '<tr></tr>',
	config: {
		baseCls: 'table'
	},
	initialize: function() {
		Helium.dataview.DataTable.__super__.initialize.apply(this, arguments);
	},
	render: function(options, silent) {
		Helium.dataview.DataView.__super__.render.apply(this, [options, true]); // N+2

		if(this.config.headings) {
			var theadBuffer = '';
			_.each(this.config.headings, function(v, k) {
				if(_.isString(v)) {
					theadBuffer += '<th>' + v + '</th>';
				} else if(_.isObject(v)) {
					theadBuffer += '<th';
					if(v.cls) theadBuffer += ' class="' + v.cls + '"';
					if(v.style) theadBuffer += ' style="' + v.style + '"';
					theadBuffer += '>' + v.text + '</th>';
				}
			});
			this.$el.children('thead').append(theadBuffer);
		}

		var tbodyBuffer = '';
		this.collection.each(function(v, k) {
			tbodyBuffer += this._compiledItemTemplate(_.extend({}, this.templateOptions, v.attributes));
		}, this);
		this.$el.children('tbody').append(tbodyBuffer);

		if(!silent) {
			this.trigger('render');
		}

		return this;
	}
});

Helium.define('Form', {
	namespace: 'Helium.form',
	extend: 'Helium.Container',
	tagName: 'form',
	config: {
		baseCls: 'form',
		action: '/'
	},
	initialize: function() {
		//console.warn(this.$className + '::initialize().config,options', [_.clone(this.config), _.clone(this.options)]);
		Helium.form.Form.__super__.initialize.apply(this, arguments);
		if(this.config.action) {
			this.setAction(this.config.action);
		}
		if(this.config.alert) {
			this.add([_.extend({object: 'Bootstrap.Alert'}, this.config.alert)]);
		}
	},
	getValues: function() {
		return this.$el.serializeArray();
	},
	setAction: function(action) {
		return this.$el.attr('action', action);
	},
	setElement: function(element, delegate) {
		Helium.form.Form.__super__.setElement.apply(this, arguments);
		if(this.config.action) {
			this.setAction(this.config.action);
		}
	}
});

Helium.define('Field', {
	namespace: 'Helium.field',
	extend: 'Helium.Component',
	tagName: 'input',
	constructor: function(options) {
		//if(options.wrap) this.tagName = 'div';
		Helium.field.Field.__super__.constructor.apply(this, arguments);
	},
	initialize: function() {
		//if(this.options.wrap) this.tagName = 'div';
		Helium.field.Field.__super__.initialize.apply(this, arguments);
	},
	render: function() {
		Helium.field.Field.__super__.render.apply(this, arguments);
		if(this.config.type) this.$el.attr('type', this.config.type);
		if(this.config.name) this.$el.attr('name', this.config.name);
		if(this.config.placeholder) this.$el.attr('placeholder', this.config.placeholder);
		/*if(this.config.wrap) {
			this.$el.wrap('div');
			this.setElement(this.$el.parent('div'));
		}*/

		return this;
	}
});

Helium.define('TextField', {
	namespace: 'Helium.field',
	extend: 'Helium.field.Field',
	tagName: 'input',
	attributes: {
		type: 'text'
	},
	initialize: function() {
		Helium.field.TextField.__super__.initialize.apply(this, arguments);
	},
	render: function() {
		Helium.field.TextField.__super__.render.apply(this, arguments);
		return this;
	}
});

Helium.define('FieldSet', {
	namespace: 'Helium.form',
	extend: 'Helium.Container',
	tagName: 'fieldset',
	initialize: function() {
		Helium.form.FieldSet.__super__.initialize.apply(this, arguments);
		if(this.options.legend || this.config.legend) this.add({html: '<legend>'/*<i class="icon-cog"></i> '*/ + (this.options.legend || this.config.legend) + '</legend>'});
	}
});

Helium.define('Router', {
	namespace: 'Helium',
	extend: 'Backbone.Router',
	views: [],
	refs: [],
	constructor: function() {
		Helium.Router.__super__.constructor.apply(this, arguments);
		this.refs = _.clone(this.refs);
	},
	initialize: function() {
		Helium.Router.__super__.initialize.apply(this, arguments);
		var self = this;

		// Initialize subViews - trash?
		this._views = _.clone(this.views);
		this.views = {};
		_.each(this._views, function(v, k) {
			var View = _.resolve(/*self.$namespace + 'Beelink.views.' + */v); // Wrong self.$namespace after inheritance
			self.views[k] = new View();
			// Define getter
			self['get' + _.ucfirst(k)] = function() { return self.views[k]; };
		});

		_.each(this.refs, function(v, k) {
			self['get' + _.ucfirst(k)] = function() { return $(v); };
		});

		//@todo controls

	}
});


Helium.define('Model', {
	namespace: 'Helium',
	extend: 'Backbone.RelationalModel',

	constructor: function() {
		Helium.Model.__super__.constructor.apply(this, arguments);
	},

	initialize: function() {
		Helium.Model.__super__.initialize.apply(this, arguments);

		// Binding "this" to be used as this, any time the function is called in the future.
		_.bindAll(this, 'onSuccess', 'onError');
	},

	parse: function(response) {

		var data = response;
		if(response.data) {
			data = response.data;
		}

		_.each(this.relations, function(relation) {
			// Handle MongoDB hasMany relationships {id1:obj1, id2:obj2}
			if(_.isObject(data[relation.key])) {
				var relObjects = _.clone(data[relation.key]);
				data[relation.key] = [];
				_.each(relObjects, function(v, k) {
					v[this.idAttribute || 'id'] = k;
					data[relation.key].push(v);
				}, this);
			}
		}, this);

		return data;
	},

	fetch: function(options) {

		var defaults = {
			_method: 'fetch',
			success: _.bind(function(model, response) { this.onSuccess(model, response, options); }, this),
			error: this.onError
		};
		options = _.defaults(options || {}, defaults);

		return Helium.Model.__super__.fetch.apply(this, [options]);
	},

	onSuccess: function(model, response, options) {

		var callbackEvent = '';
		switch(options._method) {
			case 'add': callbackEvent = 'added';break;
			case 'edit': callbackEvent = 'edited';break;
			case 'remove': callbackEvent = 'removed';break;
			case 'destroy': callbackEvent = 'destroyed';break;
			case 'bind': callbackEvent = 'bound';break;
			case 'unbind': callbackEvent = 'unbound';break;
			case 'fetch': callbackEvent = 'fetched';break;
		}

		// Triggers an event with success message
		if(callbackEvent) this.trigger(callbackEvent, model);

	},

	onError: function(model, response, options) {

		var callbackEvent = '';
		switch(options._method) {
			case 'add': callbackEvent = 'not-added';break;
			case 'edit': callbackEvent = 'not-edited';break;
			case 'remove': callbackEvent = 'not-removed';break;
			case 'destroy': callbackEvent = 'not-destroyed';break;
			case 'bind': callbackEvent = 'not-bound';break;
			case 'unbind': callbackEvent = 'not-unbound';break;
			case 'fetch': callbackEvent = 'not-fetched';break;
		}

		try {
			// Extract errors returned by the server
			response.errors = $.parseJSON(response.responseText).errors;
		} catch(e) {
			// Response status 0 (Interrupted request). Do nothing.
			if(response.status === 0) return;

			// Response from server was not a JSON encoded string (probably some debug/error output)
			response.errors = null;
			if(window.App) window.App.trigger('error', response.responseText, arguments);
		}

		// Triggers an event with error message
		if(callbackEvent) this.trigger(callbackEvent, model, response.errors);

		// Triggers a loaded event for all case
		//this.trigger('loaded');

		// Show errors to user
		//if(response.errors && response.notify) App.Base.notifyErrors(response.status, response.statusText, response.errors);

	}
});


Helium.define('Collection', {
	namespace: 'Helium',
	extend: 'Backbone.Collection',

	constructor: function() {
		// Resolve a string path to a model
		if(_.isString(this.model)) this.model = _.resolve(this.model);
		Helium.Collection.__super__.constructor.apply(this, arguments);
	},

	initialize: function() {
		Helium.Collection.__super__.initialize.apply(this, arguments);

		// Binding "this" to be used as this, any time the function is called in the future.
		_.bindAll(this, 'onSuccess', 'onError');
	},

	parse: function(response) {
		var data = response.data;
		return data;
	},

	fetch: function(options) {

		var defaults = {
			_method: 'fetch',
			success: _.bind(function(model, response) { this.onSuccess(model, response, options); }, this),
			error: this.onError
		};
		options = _.defaults(options || {}, defaults);

		return Helium.Collection.__super__.fetch.apply(this, [options]);
	},

	onSuccess: function(model, response, options) {

		var callbackEvent = '';
		switch(options._method) {
			case 'add': callbackEvent = 'added';break;
			case 'edit': callbackEvent = 'edited';break;
			case 'remove': callbackEvent = 'removed';break;
			case 'destroy': callbackEvent = 'destroyed';break;
			case 'bind': callbackEvent = 'bound';break;
			case 'unbind': callbackEvent = 'unbound';break;
			case 'fetch': callbackEvent = 'fetched';break;
		}

		// Triggers an event with success message
		if(callbackEvent) this.trigger(callbackEvent, model);

	},

	onError: function(model, response, options) {

		var callbackEvent = '';
		switch(options._method) {
			case 'add': callbackEvent = 'not-added';break;
			case 'edit': callbackEvent = 'not-edited';break;
			case 'remove': callbackEvent = 'not-removed';break;
			case 'destroy': callbackEvent = 'not-destroyed';break;
			case 'bind': callbackEvent = 'not-bound';break;
			case 'unbind': callbackEvent = 'not-unbound';break;
			case 'fetch': callbackEvent = 'not-fetched';break;
		}

		try {
			// Extract errors returned by the server
			response.errors = $.parseJSON(response.responseText).errors;
		} catch(e) {
			// Response status 0 (Interrupted request). Do nothing.
			if(response.status === 0) return;

			// Response from server was not a JSON encoded string (probably some debug/error output)
			response.errors = null;
			if(window.App) window.App.trigger('error', response.responseText, arguments);
		}

		// Triggers an event with error message
		if(callbackEvent) this.trigger(callbackEvent, model, response.errors);

		// Triggers a loaded event for all case
		//this.trigger('loaded');

		// Show errors to user
		//if(response.errors && response.notify) App.Base.notifyErrors(response.status, response.statusText, response.errors);

	},

	//
	// Subscribe to push notifications
	//
	subscribe: function() {
		var url = 'http://' + top.location.host + ':8080' + this.url;
		this.socket = io.connect(url);

		this.socket.on('edited', function (data) {
			// Get current object (@todo !exists?)
			var broadcast = App.getCollection('MainBroadcastList').get(data.response.id);
			// Avoid possible backbone side-effects
			delete data.response.id;
			// Update current broadcast if found
			if(broadcast) {
				broadcast.set(data.response).trigger('edited');
			}
		});

	}

});
