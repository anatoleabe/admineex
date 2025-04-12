angular.module('ExportStaffService', []).factory('ExportStaff', ['$http', 'CancellableHTTP', function($http, CancellableHTTP) {
    return {
        list: function(info) {
            return $http.post('/api/exportStaffs/', info);
        },
        create: function(info) {
            return $http.post('/api/exportStaffs/create', info);
        },
        delete: function(info) {
            return $http.post('/api/exportStaffs/delete', info);
        },
        read: function(info) {
            return $http.get('/api/exportStaffs/' + info.id);
        }
    }
}]);
