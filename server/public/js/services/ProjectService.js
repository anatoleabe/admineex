angular.module('ProjectService', []).factory('Project', function($http) {
    return {
        list: function() {
            return $http.get('/api/projects');
        },
        read: function(info) {
            return $http.get('/api/projects/' + info.id + '/beautify/' + info.beautify);
        },
        upsert: function(info) {
            return $http.put('/api/projects', info);
        },
        delete: function(info) {
            return $http.delete('/api/projects/' + info.id);
        }
    }
});