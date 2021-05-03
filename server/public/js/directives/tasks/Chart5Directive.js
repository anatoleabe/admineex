angular.module('Chart5Directive', []).directive("chart5", ['gettextCatalog', '$ocLazyLoad', '$injector', '$rootScope', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {
            disease: '=',
            theme: '=',
            testType: '=',
            diagnostic: '='
        },
        templateUrl: 'templates/dashboard/directives/chart5.html',
        link: function ($scope, $element, $attrs) {
            var CARD_NAME = "chart5";
            selection(CARD_NAME);
            $ocLazyLoad.load('js/services/CardService.js').then(function () {
                var Card = $injector.get('Card');
                $scope.colors = [{
                    backgroundColor: 'rgba(133, 187, 101, 1)',
                    pointBackgroundColor: 'rgba(133, 187, 101, 1)',
                    pointHoverBackgroundColor: 'rgba(133, 187, 101, 1)',
                    borderColor: 'rgba(133, 187, 101, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBorderColor: 'rgba(133, 187, 101, 1)'
                }];
                $scope.options = {
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index] + '$';
                            }
                        }
                    },
                    scales: {
                        yAxes: [{
                            scaleLabel: {
                                display: true,
                                labelString: gettextCatalog.getString('Dollars')
                            },
                            gridLines: {
                                display: false
                            }
                        }],
                        xAxes: [{
                            gridLines: {
                                display: false
                            }
                        }]
                    }
                };
                function build() {
                    var params = {
                        name: CARD_NAME,
                        laboratories: $rootScope.selectedLaboratories,
                        disease: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.disease : $rootScope.path.disease,
                        theme: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.theme : $rootScope.path.theme,
                        testType: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.testType : $rootScope.path.testType,
                        diagnostic: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.diagnostic : $rootScope.path.diagnostic
                    };
                    Card.build(params).then(function (response) {
                        var data = response.data;
                        $scope.data = data.data;
                        for (i = 0; i < data.labels.length; i++) {
                            data.labels[i] = gettextCatalog.getString(data.labels[i]);
                            data.labels[i] = data.labels[i].substr(0, 3) + ".";
                        }
                        $scope.labels = data.labels;
                        $scope.loadingChart = false;$rootScope.updateCardLoaded(CARD_NAME, !$scope.loadingChart);
                    }).catch(function (response) {
                        if (response.xhrStatus !== "abort"){
                            console.error(response);
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                        }
                        $scope.loadingChart = false;$rootScope.updateCardLoaded(CARD_NAME, !$scope.loadingChart);
                    });
                }
                $scope.loadingChart = true;$rootScope.updateCardLoaded(CARD_NAME, !$scope.loadingChart);
                build();
                var watch = {};
                watch.selectedLaboratories = $rootScope.$watch('selectedLaboratories', function (newValue, oldValue) {
                    if (newValue != oldValue) {
                        $scope.loadingChart = true;$rootScope.updateCardLoaded(CARD_NAME, !$scope.loadingChart);
                        build();
                    }
                }, true);
                watch.selected = $scope.$watch('selected', function (newValue, oldValue) {
                    if (newValue !== oldValue) {
                        $rootScope.updateDashboard(newValue, {
                            name: CARD_NAME,
                            disease: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.disease : $rootScope.path.disease,
                            theme: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.theme : $rootScope.path.theme,
                            testType: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.testType : $rootScope.path.testType,
                            diagnostic: $rootScope.state === "home.dashboard.main" ? $scope.cardConfig.diagnostic : $rootScope.path.diagnostic
                        });
                    }
                }, true);
                $scope.$on('$destroy', function() {// in case of directive destroy, we destroy the watch
                    watch.selectedLaboratories();
                    watch.selected();
                });
            });
            
            function selection(name){
                $scope.selected = $rootScope.containsCard($rootScope.state === "home.dashboard.main" ? {name: name} : {
                    name: name,
                    disease: $rootScope.path.disease,
                    theme: $rootScope.path.theme,
                    testType: $rootScope.path.testType,
                    diagnostic: $rootScope.path.diagnostic
                }, $rootScope.cards);
                if ($scope.selected === true && $rootScope.state === "home.dashboard.main") {
                    var card = $rootScope.cards.filter(function (c) {
                        return c.name === name && c.disease === $scope.disease && c.theme === $scope.theme && c.testType === $scope.testType && c.diagnostic === $scope.diagnostic;
                    })[0];
                    $scope.cardConfig = {
                        disease: card.disease,
                        theme: card.theme,
                        testType: card.testType,
                        diagnostic: card.diagnostic,
                        pretty: {
                            disease: card.pretty.disease,
                            theme: card.pretty.theme,
                            testType: card.pretty.testType,
                            diagnostic: card.pretty.diagnostic,
                        }
                    }
                }
            }
        }
    }
}]);
