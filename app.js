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
      // macros
      'click .activate_macro':'activateMacro',
      'click button.filter_macros':'filterMacros',
      // users
      'click button.filter_users':'filterUsers',
      // sessions
      'click button.kill_session':'killSession'
    },
    requests: {
      getUsers: function(page) {
        return {
          url: helpers.fmt('/api/v2/users?role[]=end-user&sort_order=desc&include=organizations&page=%@', page),
        };
      },
      getAgents: function(page) {
        return {
          url: helpers.fmt('/api/v2/users?role[]=agent&role[]=admin&sort_order=desc&include=groups&page=%@', page),
        };
      },
      getGroupMemberships: function(page) {
        return {
          url: helpers.fmt('/api/v2/group_memberships.json', page)
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
      this.$('div.filters').hide();
      // call paginate helper
      var startDate;
      var users = this._paginate({
        request : 'getUsers',
        entity  : 'users',
        page    : 1
      });
      // handle the response once the promise resolves
      users.done(_.bind(function(users){
        if(users.length !== 0) {
          // do something with results
          this.parseUsers(users.entity);
        } else {
          // hide the loader and show an error
        }
      }, this));

    },
    parseUsers: function(users) {
      // default sort
      this.users = this.convertDates( _.sortBy(users, 'created_at' ) );
      // TODO build export

      if (this.tab == 'users') {
        this.switchTo('users', {
          users: this.users
        });
      }
      
    },
    filterUsers: function(e) {
      if(e) {e.preventDefault();}
      // var sort = this.$('select.sort').val();
      var filter = this.$('select.filter').val();
      this.filteredUsers =  this.users;// TODO -for when sorting is added- _.sortBy(this.macros, sort).reverse();
      if(filter == 'active') {
        this.filteredUsers = _.filter(this.filteredUsers, function(user) {
          return !macro.suspended;
        });
      } else if(filter == 'suspended') {
        this.filteredUsers = _.filter(this.filteredUsers, function(user) {
          return user.suspended;
        });
      }
      if (this.tab == 'users') {
        this.switchTo('users', {
          users: this.filteredUsers
        });
      }
    },

    // Agents
    loadAgents: function() {
      this.$('div.filters').hide();
      // call paginate helper
      var startDate;
      var results = this._paginate({
        request : 'getAgents',
        entity  : 'users',
        page    : 1,
        sideload: 'groups'
      });
      // handle the response once the promise resolves
      results.done(_.bind(function(results){
        if(results.length !== 0) {
          // do something with results
          console.dir(results.entity);
          console.dir(results.sideload);

          this.matchGroups(results.entity, results.sideload);
        } else {
          // hide the loader and show an error
        }
      }, this));



    },
    matchGroups: function(agents, groups) {
      // handle groups sideload
      var memberships = this._paginate({
        request: 'getGroupMemberships',
        entity: 'group_memberships',
        page: 1
      });
      memberships.done(_.bind(function(memberships){
        if(memberships.length !== 0) {
          _.each(agents, function(agent) {
            // nest the membership objects in the agent object
            agent.memberships = _.filter(memberships.entity, function(membership) {
              return membership.user_id == agent.id;
            });
            // nest the group ids from the agent's nested memberships
            agent.group_ids = _.map(agent.memberships, function(membership){
              return membership.group_id;
            });
            // nest the group names from the agent's nested group IDs
            agent.groups = _.filter(groups, function(group) {
              return _.contains(agent.group_ids, group.id);  // group.id == agent.membership_id;
            });
          }.bind(this));
          console.dir(agents);

          // when done
          this.parseAgents(agents);
        } else {
          // hide the loader and show an error
        }
      }, this));
    },
    parseAgents: function(agents) {
      // default sort
      this.agents = this.convertDates( _.sortBy(agents, 'created_at' ) );
      // create file URL
      var data = this.renderTemplate('_agents_export', {
        agents: this.agents
      });
      var file = new File([data], 'agents.csv');
      var url = URL.createObjectURL(file);

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
      var macros = this._paginate({
        request : 'getMacros',
        entity  : 'macros',
        page    : 1
      });
      // handle the response once the promise resolves
      macros.done(_.bind(function(macros){
        if(macros.length !== 0) {
          // do something with results
          this.parseMacros(macros.entity);
        } else {
          // hide the loader and show an error

        }
      }, this));
    },
    parseMacros: function(macros) {
      // sort the results
      this.macros = this.convertDates( _.sortBy(macros, 'updated_at').reverse() );
      // TODO build export

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

      var sessions = this._paginate({
        request : 'getSessions',
        entity  : 'sessions',
        page    : 1
      });
      // handle the response once the promise resolves
      sessions.done(_.bind(function(sessions){
        if(sessions.length !== 0) {
          // do something with results
          this.parseSessions(sessions.entity);
        } else {
          // hide the loader and show an error

        }
      }, this));
    },
    parseSessions: function(sessions) {
      this.sessions = this.convertDates( _.sortBy(sessions, 'last_seen_at').reverse() );
      // TODO build export
      // TODO get user names
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
      var sideloads = {};

      var initialRequest = this.ajax(a.request, a.page);
      // create and return a promise chain of requests to subsequent pages
      var allPages = initialRequest.then(function(data){
        results.push(data[a.entity]);

        _.each(a.sideloads, function(sideload) { // test pushing sideload data TODO this should loop over a.sideloads
          sideloads[ sideload ] = data[ sideload ];
        }.bind(this));
        console.dir(sideloads);


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

          // test
          _.each(a.sideloads, function(sideload) {
            var more = _.chain(arguments)
                          .flatten()
                          .filter(function(item){ return (_.isObject(item) && _.has(item, sideload)); })
                          .map(function(item){ return item[sideload]; })
                          .value();
            _.extend(sideloads[ sideload ], more); //TODO pass a real object
          }.bind(this));
          // end test
          
        }).then(function(){
          var response = {
            results: results,
            sideloads: sideloads
          };
          return response;
        });
      });
      return allPages;
    },

    _paginate: function(a) {
      var results = {
        "entity":[],
        "sideload":[]
      };
      var initialRequest = this.ajax(a.request, a.page);
      // create and return a promise chain of requests to subsequent pages
      var allPages = initialRequest.then(function(data) {
          results.entity.push(data[a.entity]);
          results.sideload.push(data[a.sideload]);
          var nextPages = [];
          var pageCount = Math.ceil(data.count / 100);
          for (; pageCount > 1; --pageCount) {
              nextPages.push(this.ajax(a.request, pageCount));
          }
          return this.when.apply(this, nextPages).then(function() {
              var entities = _.chain(arguments)
                  .flatten()
                  .filter(function(item) {
                      return (_.isObject(item) && _.has(item, a.entity));
                  })
                  .map(function(item) {
                      return item[a.entity];
                  })
                  .value();
              results.entity.push(entities);
          }).then(function() {
              var neat_entity =  _.chain(results.entity)
                  .flatten()
                  .compact()
                  .value();
              results.entity = neat_entity;
              var neat_sideload = _.chain(results.sideload)
                .flatten()
                .compact()
                .value();
              results.sideload = neat_sideload;
              return results;
          });
      });
      return allPages;
    }

  };
}());
