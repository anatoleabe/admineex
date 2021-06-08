angular.module('NavPathDirective', []).directive('navpath', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/procrastinate/tasks/directives/navpath.html',
        link: function ($scope, $element, $attrs, scope) {
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.loading = true;
                $scope.currentNavItem = "Histoire";

                $scope.onlyAssignee = function (item) {
                    console.log(item)
                    if (item.history.field == "Assignee") {
                        return true;
                    } else {
                        return false;
                    }

                };

                Task.history({
                    id: $rootScope.selectedTaskId
                }).then(function (response) {
                    $scope.histories = response.data;
                }).catch(function (response) {
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
