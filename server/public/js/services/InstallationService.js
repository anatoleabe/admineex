angular.module('InstallationService', []).factory('Installation', function($http) {
    return {        
        read: function() {
            return $http.get('/api/installation');
        },
        
        update: function(config) {
            return $http.put('/api/installation', config);
        },
        
        admin: function(user) {
            return $http.put('/api/installation/admin', user);
        },
        
        status: function() {
            return $http.get('/api/installation/status');
        }
    };
});