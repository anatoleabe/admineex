angular.module('ExportService', []).factory('Export', function($http) {
    return {
        exportPositions: function() {
            return $http.get('/api/export/pdf/positions/');
        },
    }
});