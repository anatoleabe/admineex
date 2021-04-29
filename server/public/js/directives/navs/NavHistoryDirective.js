angular.module('NavHistoryDirective', []).directive('navhistory', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/procrastinate/tasks/directives/navhistory.html',
        link: function ($scope, $element, $attrs, scope) {
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.loading = true;
                $scope.currentNavItem = "Histoire";

                console.log($rootScope.taskhistory)
                Task.history({
                    id: $rootScope.selectedTaskId
                }).then(function (response) {
                    console.log(response)
                    
                }).catch(function (response) {
                    console.log(response);
                    $rootScope.kernel.alerts.push({
                        type: 1,
                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                        priority: 2
                    });
                });
            });
        }
    };
});
