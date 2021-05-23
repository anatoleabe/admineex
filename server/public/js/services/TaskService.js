angular.module('TaskService', []).factory('Task', function($http) {
    return {
        list: function(filters) {
            return $http.get('/api/tasks/'+filters.status+'/'+filters.priority+'/'+filters.category
                    + '/' + filters.from 
                    + '/' + filters.to 
                    + '/' + ((filters.globalView && filters.globalView.activated == true && filters.globalView.selectedUser != undefined ) ? filters.globalView.selectedUser:'undefined')
                    + '/' + filters.searchterms ) ;
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
        update: function(info) {
            return $http.post('/api/task', info);
        },
        delete: function(info) {
            return $http.delete('/api/task/' + info.id);
        },
        history: function(info) {
            return $http.get('/api/taskHistory/' + info.id);
        },
        comments: function(info) {
            return $http.get('/api/taskComments/' + info.id);
        },
        deleteComments: function(info) {
            console.log(info)
            return $http.delete('/api/taskCommentDelete/' + info.id+'/'+info.cindex);
        }
    }
});