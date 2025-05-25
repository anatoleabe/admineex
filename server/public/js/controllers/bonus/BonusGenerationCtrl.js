app.controller('BonusGenerationCtrl', ['$scope', '$http', '$mdDialog', 'BonusService', 
function($scope, $http, $mdDialog, BonusService) {
    $scope.loading = false;
    $scope.templates = [];
    $scope.selectedTemplate = null;
    $scope.generationData = {
        templateId: '',
        title: '',
        description: '',
        periodStart: new Date(),
        periodEnd: new Date(),
        customParameters: {}
    };
    
    $scope.loadTemplates = function() {
        $scope.loading = true;
        BonusService.getTemplates({ activeOnly: true }).then(function(response) {
            $scope.templates = response.data;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = 'Erreur lors du chargement des modèles de prime';
        });
    };
    
    $scope.selectTemplate = function() {
        if (!$scope.generationData.templateId) {
            $scope.selectedTemplate = null;
            return;
        }
        
        var template = $scope.templates.find(function(t) {
            return t._id === $scope.generationData.templateId;
        });
        
        $scope.selectedTemplate = template;
        
        var today = new Date();
        var month = today.getMonth() + 1;
        var year = today.getFullYear();
        
        $scope.generationData.title = template.name + ' - ' + month + '/' + year;
        
        $scope.setPeriodFromPeriodicity(template.periodicity);
    };
    
    $scope.setPeriodFromPeriodicity = function(periodicity) {
        var today = new Date();
        var startDate = new Date(today);
        var endDate = new Date(today);
        
        switch (periodicity) {
            case 'daily':
                break;
                
            case 'weekly':
                var day = today.getDay();
                var diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
                startDate = new Date(today.setDate(diff));
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
                
            case 'monthly':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
                
            case 'quarterly':
                var quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                endDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
                break;
                
            case 'semesterly':
                var semester = Math.floor(today.getMonth() / 6);
                startDate = new Date(today.getFullYear(), semester * 6, 1);
                endDate = new Date(today.getFullYear(), (semester + 1) * 6, 0);
                break;
                
            case 'yearly':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
                
            case 'on_demand':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
        }
        
        $scope.generationData.periodStart = startDate;
        $scope.generationData.periodEnd = endDate;
    };
    
    $scope.generateBonus = function() {
        $scope.loading = true;
        BonusService.generateBonus($scope.generationData).then(function(response) {
            $scope.loading = false;
            $mdDialog.hide({ success: true, instance: response.data });
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = error.data && error.data.message ? error.data.message : 'Erreur lors de la génération de la prime';
        });
    };
    
    $scope.cancel = function() {
        $mdDialog.cancel();
    };
    
    $scope.loadTemplates();
}]);
