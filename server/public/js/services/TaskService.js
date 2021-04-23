angular.module('TaskService', []).factory('Task', function($http) {
    return {
        list: function(filters) {
            console.log(filters)
            return $http.get('/api/tasks/'+filters.status+'/'+filters.priority+'/'+filters.category);
        },
        read: function(info) {
            return $http.get('/api/task/' + info.id);
        },
        readForEdit: function(info) {
            return $http.get('/api/editTask/' + info.id);
        },
        upsert: function(info) {
            return $http.put('/api/task', info);
        },
        delete: function(info) {
            return $http.delete('/api/task/' + info.id);
        }
    }
});