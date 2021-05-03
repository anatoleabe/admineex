angular.module('Procras2Directive', []).directive('procras2', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras2.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $scope.loading = true;
                $scope.loadingChart = false;
                
                $scope.nbTasks = 15;
            });
        }
    };
});
