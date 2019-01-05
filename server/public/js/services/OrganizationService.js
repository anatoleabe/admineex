angular.module('OrganizationService', []).factory('Organization', function($http) {
    return {
        list: function() {
            return $http.get('/api/organizations');
        },
        read: function(info) {
            return $http.get('/api/organizations/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/organizations', info);
        },
        delete: function(info) {
            return $http.delete('/api/organizations/' + info.id);
        }
    }
});