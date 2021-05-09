angular.module('Procras5Directive', []).directive('procras5', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras5.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $scope.labels = [ gettextCatalog.getString('Completed'), gettextCatalog.getString('In progress'), gettextCatalog.getString('Not stared')];
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');
                $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                    var Card = $injector.get('Chart');

                    $scope.colors = [{
                            backgroundColor: 'rgba(0, 128, 1, 0.6)',//GRAY - NOT STARTED
                            pointBackgroundColor: 'rgba(0, 128, 1, 0.6)',
                            pointHoverBackgroundColor: 'rgba(0, 128, 1, 0.6)',
                            borderColor: 'rgba(0, 128, 1, 1)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(0, 128, 1, 0.6)',
                        },{
                            backgroundColor: 'rgba(255, 140, 2, 0.6)',//YELLO-INPROGRESS
                            pointBackgroundColor: 'rgba(255, 140, 2, 0.6)',
                            pointHoverBackgroundColor: 'rgba(255, 140, 2, 0.6)',
                            borderColor: 'rgba(255, 140, 2, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(255, 140, 2, 0.6)'
                        },{
                            backgroundColor: 'rgba(128, 128, 128, 0.6)',//GREEN-COMPLETED
                            pointBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            pointHoverBackgroundColor: 'rgba(128, 128, 128, 0.6)',
                            borderColor: 'rgba(128, 128, 128, 0.6)',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: 'rgba(128, 128, 128, 0.6)'
                        },  ];
                    $scope.options = {
                        tooltips: {
                            callbacks: {
                                label: function (tooltipItem, data) {
                                    var datasetLabel = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                                    var total = data.datasets[tooltipItem.datasetIndex].data[0] + data.datasets[tooltipItem.datasetIndex].data[1];
                                    var percent = Math.round((datasetLabel * 100) / total);
                                    var label = data.labels[tooltipItem.index];
                                    return label + gettextCatalog.getString(':') + ' ' + '(' + datasetLabel + ')' + ' ' + percent + '%';
                                }
                            }
                        },
                        legend: {
                            display: true,
                            position: 'bottom',
                            reverse: true
                        }
                    }

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
                            $scope.data = [data.completed, data.inprogress, data.notstarted]


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
