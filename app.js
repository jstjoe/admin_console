(function() {

  return {
    defaultState: 'spinner',
    startTab: 'agents',
    events: {
      'app.activated':'onActivated',
      // override tabs
      'click .tab':'tabClicked',
      'click .activate_macro':'activateMacro'
    },
    requests: {
      getAgents: function(page) {
        return {
          url: helpers.fmt('/api/v2/users?role[]=agent&role[]=admin&sort_order=desc&include=identities,roles,groups&page=%@', page),
        };
      },
      getMacros: function(page) {
        return {
          url: helpers.fmt('/api/v2/macros.json?page=%@', page)
        };
      },
      activate: function(link) {
        return {
          url: link
        };
      }
    },

    onActivated: function() {
      this.tab = 'agents';
      this.loadAgents();
    },

    tabClicked: function(e) {
      e.preventDefault();
      var tab = e.currentTarget.id;
      // select the clicked tab
      this.$('li.tab').removeClass('active');
      this.$('#' + tab).addClass('active');
      this.switchTo('spinner');// show the loading template for now
      // detect the tab and call the appropriate function (or just show a template)
      if (tab == 'agents') {
        this.tab = 'agents';
        this.loadAgents();
      } else if(tab == 'macros') {
        this.tab = 'macros';
        this.loadMacros();
      } else {
        // render an error whenever an unsupported tab is chosen
        this.switchTo('error');
      }
    },

    loadAgents: function() {
      // call paginate helper
      var startDate;
      var agents = this.paginate({
        request : 'getAgents',
        entity  : 'users',
        page    : 1
      });
      // handle the response once the promise resolves
      agents.done(_.bind(function(agents){
        if(agents.length !== 0) {
          // do something with results
          this.parseAgents(agents);
        } else {
          // hide the loader and show an error
        }
      }, this));

    },
    parseAgents: function(agents) {
      var sortedAgents = _.sortBy(agents, 'created_at' );
      if (this.tab == 'agents') {
        this.switchTo('agents', {
          agents: sortedAgents
        });
      }
      
    },

    loadMacros: function() {
      // call paginate helper
      var startDate;
      var macros = this.paginate({
        request : 'getMacros',
        entity  : 'macros',
        page    : 1
      });
      // handle the response once the promise resolves
      macros.done(_.bind(function(macros){
        if(macros.length !== 0) {
          // do something with results
          this.parseMacros(macros);
        } else {
          // hide the loader and show an error

        }
      }, this));
    },
    parseMacros: function(macros) {
      // sort the results
      var sortedMacros = _.sortBy(macros, 'updated_at' ).reverse();
      // convert the date strings
      sortedMacros = this.convertDates(sortedMacros);
      // check that the user is still on the given tab (to handle asychronicity)
      if (this.tab == 'macros') {
        this.switchTo('macros', {
          macros: sortedMacros
        });
      }
    },
    activateMacro: function(e) {
      e.preventDefault();
      var link = e.currentTarget.dataset.activateLink;
      console.dir(link);
      // var spinner = this.renderTemplate('spinner_small');
      // var spinner = '...';
      // this.$('button[data-activate-link="' + link + '"]').html(spinner);
      this.ajax('activate', link).done(function(data) {
        if(e.currentTarget.dataset.activated == 'true') {
          this.$('button[data-activate-link="' + link + '"]').html('Activate');
          this.$('button[data-activate-link="' + link + '"]').attr('data-activated', 'false');
        } else {
          this.$('button[data-activate-link="' + link + '"]').html('Deactivate');
          this.$('button[data-activate-link="' + link + '"]').attr('data-activated', 'true');
        }
      });
    },

    // ## Helpers
    convertDates: function(results) {
      _.each(results, function(result) {
        result.created_at = new Date(result.created_at).toLocaleString();
        result.updated_at = new Date(result.updated_at).toLocaleString();
      });
      return results;
    },
    paginate: function(a) {
      var results = [];
      var initialRequest = this.ajax(a.request, a.page);
      // create and return a promise chain of requests to subsequent pages
      var allPages = initialRequest.then(function(data){
        results.push(data[a.entity]);
        var nextPages = [];
        var pageCount = Math.ceil(data.count / 100);
        for (; pageCount > 1; --pageCount) {
          nextPages.push(this.ajax(a.request, pageCount));
        }
        return this.when.apply(this, nextPages).then(function(){
          var entities = _.chain(arguments)
                          .flatten()
                          .filter(function(item){ return (_.isObject(item) && _.has(item, a.entity)); })
                          .map(function(item){ return item[a.entity]; })
                          .value();
          results.push(entities);
        }).then(function(){
          return _.chain(results)
                  .flatten()
                  .compact()
                  .value();
        });
      });
      return allPages;
    }
  };

}());
