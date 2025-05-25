app.factory('BonusService', ['$http', function($http) {
    return {
        getTemplates: function(filters) {
            return $http.get('/api/bonus/templates', { params: filters });
        },
        getTemplate: function(id) {
            return $http.get('/api/bonus/templates/' + id);
        },
        createTemplate: function(template) {
            return $http.post('/api/bonus/templates', template);
        },
        updateTemplate: function(id, template) {
            return $http.put('/api/bonus/templates/' + id, template);
        },
        deleteTemplate: function(id) {
            return $http.delete('/api/bonus/templates/' + id);
        },
        activateTemplate: function(id) {
            return $http.post('/api/bonus/templates/' + id + '/activate');
        },
        deactivateTemplate: function(id) {
            return $http.post('/api/bonus/templates/' + id + '/deactivate');
        },
        cloneTemplate: function(id) {
            return $http.post('/api/bonus/templates/' + id + '/clone');
        },
        validateTemplate: function(template) {
            return $http.post('/api/bonus/templates/validate', template);
        },
        
        getInstances: function(filters) {
            return $http.get('/api/bonus/instances', { params: filters });
        },
        getInstance: function(id) {
            return $http.get('/api/bonus/instances/' + id);
        },
        approveInstance: function(id, data) {
            return $http.post('/api/bonus/instances/' + id + '/approve', data);
        },
        rejectInstance: function(id, data) {
            return $http.post('/api/bonus/instances/' + id + '/reject', data);
        },
        
        getAllocations: function(instanceId, filters) {
            return $http.get('/api/bonus/instances/' + instanceId + '/allocations', { params: filters });
        },
        updateAllocation: function(instanceId, allocationId, data) {
            return $http.put('/api/bonus/instances/' + instanceId + '/allocations/' + allocationId, data);
        },
        
        generateBonus: function(data) {
            return $http.post('/api/bonus/generate', data);
        },
        
        getPersonnelSnapshots: function(filters) {
            return $http.get('/api/bonus/personnel-snapshots', { params: filters });
        },
        
        generatePaymentFile: function(instanceId, format) {
            return $http.get('/api/bonus/instances/' + instanceId + '/payment-file', { 
                params: { format: format },
                responseType: 'arraybuffer'
            });
        },
        
        getBonusReports: function(filters) {
            return $http.get('/api/bonus/reports', { params: filters });
        },
        
        getReportByStructure: function(filters) {
            return $http.get('/api/bonus/reports/by-structure', { params: filters });
        },
        getReportByPeriod: function(filters) {
            return $http.get('/api/bonus/reports/by-period', { params: filters });
        },
        getReportByTemplate: function(filters) {
            return $http.get('/api/bonus/reports/by-template', { params: filters });
        },
        exportReport: function(data) {
            return $http.post('/api/bonus/reports/export', data, { 
                responseType: 'arraybuffer' 
            });
        }
    };
}]);
