angular.module('TaskService', []).factory('Task', function($http) {
    return {
        list: function() {
            return $http.get('/api/tasks');
        },
        read: function(info) {
            return $http.get('/api/tasks/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/tasks', info);
        },
        delete: function(info) {
            return $http.delete('/api/tasks/' + info.id);
        }
    }
});