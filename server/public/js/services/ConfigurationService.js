angular.module('ConfigurationService', []).factory('Configuration', function($http) {
    return {
        read: function() {
            return $http.get('/api/configuration');
        },
        
        update: function(config) {
            return $http.put('/api/configuration', config);
        }
    };
});