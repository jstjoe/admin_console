/*global Blob*/
/*global URL*/
/*global File*/
(function() {

  return {
    defaultState: 'spinner',
    startTab: 'agents',
    events: {
      'app.activated':'onActivated',
      // override tabs
      'click .tab':'tabClicked',

      'click .activate_macro':'activateMacro',
      'click button.filter_macros':'filterMacros',

      'click button.kill_session':'killSession'
    },
    requests: {
      getUsers: function(page) {
        return {
          url: helpers.fmt('/api/v2/users?role[]=end-user&sort_order=desc&include=identities,roles,organizations&page=%@', page),
        };
      },
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
      },
      getSessions: function(page) {
        return {
          url: helpers.fmt('/api/v2/sessions?page=%@', page),
        };
      },
      killSession: function(url) {
        return {
          url: url,
          type: 'delete'
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
      if(tab == 'users') {
        this.tab = 'users';
        this.loadUsers();
      } else if (tab == 'agents') {
        this.tab = 'agents';
        this.loadAgents();
      } else if(tab == 'macros') {
        this.tab = 'macros';
        this.loadMacros();
      } else if(tab == 'sessions') {
        this.tab = 'sessions';
        this.loadSessions();

      } else {
        // render an error whenever an unsupported tab is chosen
        this.switchTo('error');
      }
    },
    // Users
    loadUsers: function() {
      // call paginate helper
      var startDate;
      var users = this.paginate({
        request : 'getUsers',
        entity  : 'users',
        page    : 1
      });
      // handle the response once the promise resolves
      users.done(_.bind(function(users){
        if(users.length !== 0) {
          // do something with results
          this.parseUsers(users);
        } else {
          // hide the loader and show an error
        }
      }, this));

    },
    parseUsers: function(users) {
      var sortedUsers = _.sortBy(users, 'created_at' );
      if (this.tab == 'users') {
        console.dir(sortedUsers);
        this.switchTo('users', {
          users: sortedUsers
        });
      }
      
    },
    // Agents
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
      // default sort
      var sortedAgents = _.sortBy(agents, 'created_at' );
      this.agents = this.convertDates(sortedAgents);
      // create file URL
      var data = this.renderTemplate('_agents_export', {
        agents: this.agents
      });
      var file = new File([data], 'agents.csv');
      var url = URL.createObjectURL(file);

      console.log(url);
      if (this.tab == 'agents') {
        this.switchTo('agents', {
          agents: this.agents,
          export_url: url
        });
      }
      
    },

    loadMacros: function() {
      // call paginate helper
      this.$('div.filters').html( this.renderTemplate('_macro_filters') );
      this.$('div.filters').show();
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
      var sortedMacros = _.sortBy(macros, 'updated_at').reverse();
      // convert the date strings
      this.macros = this.convertDates(sortedMacros);
      // check that the user is still on the given tab (to handle asychronicity)
      if (this.tab == 'macros') {
        this.switchTo('macros', {
          macros: this.macros
        });
      }
    },
    filterMacros: function(e) {
      e.preventDefault();
      var sort = this.$('select.sort').val();
      var filter = this.$('select.filter').val();
      this.filteredMacros = _.sortBy(this.macros, sort).reverse();
      if(filter == 'active') {
        this.filteredMacros = _.filter(this.filteredMacros, function(macro) {
          return macro.active;
        });
      } else if(filter == 'inactive') {
        this.filteredMacros = _.filter(this.filteredMacros, function(macro) {
          return !macro.active;
        });
      }
      if (this.tab == 'macros') {
        this.switchTo('macros', {
          macros: this.filteredMacros
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
    // # Sessions
    loadSessions: function() {
      // this.$('div.filters').html( this.renderTemplate('_macro_filters') );
      this.$('div.filters').hide();
      // call paginate helper

      var sessions = this.paginate({
        request : 'getSessions',
        entity  : 'sessions',
        page    : 1
      });
      // handle the response once the promise resolves
      sessions.done(_.bind(function(sessions){
        if(sessions.length !== 0) {
          // do something with results
          this.parseSessions(sessions);
        } else {
          // hide the loader and show an error

        }
      }, this));
    },
    parseSessions: function(sessions) {
      // sort the results
      var sortedSessions = _.sortBy(sessions, 'last_seen_at').reverse();
      // convert the date strings
      this.sessions = this.convertDates(sortedSessions);
      // check that the user is still on the given tab (to handle asychronicity)
      if (this.tab == 'sessions') {
        this.switchTo('sessions', {
          sessions: this.sessions
        });
      }
    },
    killSession: function(e) {
      e.preventDefault();
      console.dir(e);
      var url = e.currentTarget.dataset.killUrl;
      console.log(url);
      this.ajax('killSession', url).done(function(response) {
        services.notify('Session killed!');
        this.loadSessions();
      });
    },


    // ## Helpers
    convertDates: function(results) {
      _.each(results, function(result) {
        result.created_at = new Date(result.created_at).toLocaleString();
        result.updated_at = new Date(result.updated_at).toLocaleString();

        if(result.authenticated_at) {
          result.authenticated_at = new Date(result.authenticated_at).toLocaleString();
          result.last_seen_at = new Date(result.last_seen_at).toLocaleString();
        }
        
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
