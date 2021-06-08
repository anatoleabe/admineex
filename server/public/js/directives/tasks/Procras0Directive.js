angular.module('Procras0Directive', []).directive('procras0', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras0.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                    var Card = $injector.get('Chart');
                    $scope.loading = true;
                    $scope.loadingChart = false;
                    $scope.nbTasks = 38;
                    $scope.tasks1 = 0;
                    $scope.tasks = {}
                    var CARD_NAME = "procras0";
                    function build() {
                        var params = {
                            name: CARD_NAME,
                            from: $rootScope.range.from.value,
                            to: $rootScope.range.to.value,
                            globalView: $rootScope.globalView,
                        };
                        Card.build(params).then(function (response) {
                            var data = response.data;
                            $scope.tasks = data;
                            $scope.nbTasks = 50;


                            $scope.loadingChart = false;
                        }).catch(function (response) {
                            if (response.xhrStatus !== "abort") {
                                console.error(response);
                                $rootScope.kernel.alerts.push({
                                    type: 1,
                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                    priority: 2
                                });
                            }
                            $scope.loadingChart = false;
                        });
                    }
                    $scope.loadingChart = true;
                    build();
                    
                    var watch = {};
                    watch.range = $rootScope.$watch('range', function (newValue, oldValue) {
                        if (newValue.from.value.getTime() !== oldValue.from.value.getTime() || newValue.to.value.getTime() !== oldValue.to.value.getTime()) {
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    watch.selectedUser = $rootScope.$watch('globalView.selectedUser', function (newValue, oldValue) {
                        if (newValue !== oldValue) {
                            console.log(newValue)
                            $scope.loadingChart = true;
                            build();
                        }
                    }, true);
                    $scope.$on('$destroy', function () {// in case of directive destroy, we destroy the watch
                        watch.range();
                        watch.selectedUser();
                    });
                });
            });
        }
    };
});
