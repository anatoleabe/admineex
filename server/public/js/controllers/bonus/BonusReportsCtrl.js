angular.module('app').controller('BonusReportsController', ['$scope', '$rootScope', '$http', 'toastr', '$timeout', '$q', 'gettextCatalog', function ($scope, $rootScope, $http, toastr, $timeout, $q, gettextCatalog) {
    function t(msgid) {
        return gettextCatalog.getString(msgid);
    }
    $scope.loading = false;          // main report loading (instances + allocations)
    $scope.exporting = false;        // PDF export in progress
    // Ensure kernel object exists on root scope for global progress indicator
    $rootScope.kernel = $rootScope.kernel || {};
    if (typeof $rootScope.kernel.loading !== 'number') {
        $rootScope.kernel.loading = 100; // default to fully loaded
    }
    $scope.templates = [];
    $scope.instances = [];
    $scope.filteredRows = { with_parts: [], without_parts: [], others: [] };
    $scope.totals = {
        with_parts: { gross: 0, ir: 0, nap: 0 },
        without_parts: { gross: 0, ir: 0, nap: 0 },
        others: { gross: 0, ir: 0, nap: 0 },
        all: { gross: 0, ir: 0, nap: 0 }
    };

    // Internal state for debouncing and race-conditions protection
    var refreshDebouncePromise = null;
    var refreshSeq = 0; // increment on each refresh start
    var activeRefreshes = 0; // number of in-flight refreshes
    var personnelSearchTimeout = null; // debounce handle for personnel search

    function getCurrentYearRange() {
        const year = new Date().getFullYear();
        // Use noon to avoid timezone shifting the date back when converting to ISO
        return {
            from: new Date(year, 0, 1, 12, 0, 0),
            to: new Date(year, 11, 31, 12, 0, 0)
        };
    }

    const defaultRange = getCurrentYearRange();

    $scope.filters = {
        category: '',
        status: '',
        fromDate: defaultRange.from,
        toDate: defaultRange.to,
        personnel: null,
        searchPersonnel: ''
    };

    var instanceStatusLabels = {
        draft: t('Draft'),
        pending_generation: t('Pending Generation'),
        generated: t('Generated'),
        under_review: t('Under Review'),
        approved: t('Approved'),
        paid: t('Paid'),
        cancelled: t('Cancelled')
    };
    function formatStatusLabel(status) {
        return instanceStatusLabels[status] || String(status || '').replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
    }
    const instanceStatuses = ['draft', 'pending_generation', 'generated', 'under_review', 'approved', 'paid', 'cancelled'];
    $scope.statusOptions = [{ value: '', label: t('All Statuses') }].concat(instanceStatuses.map(function (st) {
        return { value: st, label: formatStatusLabel(st) };
    }));

    $scope.categoryOptions = [
        { value: '', label: t('All categories') },
        { value: 'with_parts', label: t('With Parts') },
        { value: 'without_parts', label: t('Without Parts') },
        { value: 'fixed_amount', label: t('Fixed Amount') },
        { value: 'calculated', label: t('Calculated') }
    ];

    function formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    }

    function get(obj, path, fallback) {
        try {
            var parts = path.split('.');
            var cur = obj;
            for (var i = 0; i < parts.length; i++) {
                if (!cur || typeof cur !== 'object') return fallback;
                cur = cur[parts[i]];
            }
            return (cur === undefined || cur === null) ? fallback : cur;
        } catch (e) { return fallback; }
    }

    function normalizeInstance(instance) {
        if (!instance) return null;
        var templateId = (instance.templateId && (instance.templateId._id || instance.templateId)) || instance.templateId;
        var template = null;
        for (var i = 0; i < $scope.templates.length; i++) {
            if ($scope.templates[i]._id === templateId) { template = $scope.templates[i]; break; }
        }
        // Fallback to embedded template object if any
        if (!template && instance.templateId && typeof instance.templateId === 'object') {
            template = instance.templateId;
        }
        const category = (template && template.category) ? template.category : (instance.category || '');

        // Prefer backend-computed tax percentage/rate when available, otherwise fallback to template config
        var effectiveTax;
        if (typeof instance.taxRate === 'number') {
            effectiveTax = instance.taxRate; // already in percentage from backend getAll
        } else if (typeof instance.taxPercentage === 'number') {
            effectiveTax = instance.taxPercentage;
        } else {
            effectiveTax = get(template, 'taxConfig.taxPercentage', 5.28);
        }

        const paymentDate = instance.paymentDate || instance.approvalDate || instance.updatedAt || instance.createdAt;
        const code = template && template.code ? template.code : '';
        const name = template && template.name ? template.name : t('Bonus');

        return {
            _id: instance._id,
            name: name,
            code: code,
            category: category,
            referencePeriod: instance.referencePeriod,
            createdAt: instance.createdAt,
            paymentDate: paymentDate,
            status: instance.status,
            taxPercentage: effectiveTax,
            raw: instance
        };
    }

    function computeRow(instance, amountTotals) {
        var gross = 0, ir = 0, nap = 0;
        if (amountTotals && typeof amountTotals === 'object') {
            if (amountTotals.gross != null) gross = Number(amountTotals.gross);
            else if (amountTotals.net != null) gross = Number(amountTotals.net);
            ir = Number(amountTotals.tax != null ? amountTotals.tax : 0);
            nap = Number(amountTotals.net != null ? amountTotals.net : 0);
        }
        return {
            category: instance.category || '',
            label: instance.name + (instance.code ? ' (' + instance.code + ')' : ''),
            period: instance.referencePeriod,
            status: instance.status,
            paymentDate: instance.paymentDate,
            gross: gross,
            ir: ir,
            nap: nap
        };
    }

    function applyClientFilters(instances) {
        return instances.filter(function (inst) {
            if ($scope.filters.category && inst.category !== $scope.filters.category) return false;
            return true;
        });
    }

    function sumTotals(rows, key) {
        return rows.reduce(function (acc, r) { return acc + Number(r[key] || 0); }, 0);
    }

    function buildTotals(rowsWithParts, rowsWithoutParts, rowsOthers) {
        $scope.totals.with_parts.gross = sumTotals(rowsWithParts, 'gross');
        $scope.totals.with_parts.ir = sumTotals(rowsWithParts, 'ir');
        $scope.totals.with_parts.nap = sumTotals(rowsWithParts, 'nap');

        $scope.totals.without_parts.gross = sumTotals(rowsWithoutParts, 'gross');
        $scope.totals.without_parts.ir = sumTotals(rowsWithoutParts, 'ir');
        $scope.totals.without_parts.nap = sumTotals(rowsWithoutParts, 'nap');

        $scope.totals.others.gross = sumTotals(rowsOthers, 'gross');
        $scope.totals.others.ir = sumTotals(rowsOthers, 'ir');
        $scope.totals.others.nap = sumTotals(rowsOthers, 'nap');

        $scope.totals.all.gross = $scope.totals.with_parts.gross + $scope.totals.without_parts.gross + $scope.totals.others.gross;
        $scope.totals.all.ir = $scope.totals.with_parts.ir + $scope.totals.without_parts.ir + $scope.totals.others.ir;
        $scope.totals.all.nap = $scope.totals.with_parts.nap + $scope.totals.without_parts.nap + $scope.totals.others.nap;
    }

    function attachAmountsToInstances(instances, allocationMap, hasPersonnelFilter) {
        return instances.map(function (inst) {
            var totals;
            // If we have personnel-specific allocations for this instance, use them
            if (allocationMap && allocationMap[inst._id]) {
                totals = allocationMap[inst._id];
            } else {
                // When filtering by personnel, hide instances where they have no allocation
                if (hasPersonnelFilter) return null;
                // Otherwise use backend totals from the instance itself
                var raw = inst.raw || {};
                var gross = Number(raw.totalAmount != null ? raw.totalAmount : 0);
                var tax = Number(raw.totalTax != null ? raw.totalTax : 0);
                var net = Number(raw.totalNet != null ? raw.totalNet : 0);

                // Fallbacks if some fields are missing
                if (!net && gross && tax) {
                    net = gross - tax;
                }
                if (!gross && net && tax) {
                    gross = net + tax;
                }

                totals = {
                    gross: gross,
                    tax: tax,
                    net: net || gross
                };
            }
            return computeRow(inst, totals);
        }).filter(Boolean);
    }

    // Fetch allocations for a single personnel to reduce per-instance figures
    function loadAllocationsByPersonnel(personnelId) {
        if (!personnelId) return $q.when({});
        const params = {
            personnelId: personnelId,
            limit: 5000,
            envelope: true
        };
        if ($scope.filters.fromDate) params.fromDate = formatDate($scope.filters.fromDate);
        if ($scope.filters.toDate) params.toDate = formatDate($scope.filters.toDate);

        return $http.get('/api/bonus/allocations', { params: params }).then(function (response) {
            const items = response.data.items || [];
            const grouped = {};
            items.forEach(function (allocation) {
                const instId = allocation.instanceId && (allocation.instanceId._id || allocation.instanceId);
                if (!instId) return;
                const net = Number(allocation.netAmount || allocation.finalAmount || 0);
                const gross = Number(allocation.grossAmount || allocation.calculatedAmount || net);
                const tax = Number(allocation.taxAmount || (gross - net));
                if (!grouped[instId]) grouped[instId] = { gross: 0, tax: 0, net: 0 };
                grouped[instId].gross += gross;
                grouped[instId].tax += tax;
                grouped[instId].net += net;
            });
            return grouped;
        }).catch(function (err) {
            console.error('Failed to load allocations by personnel', err);
            toastr.error(t('Failed to load personnel allocations for report'));
            return $q.when({});
        });
    }

    function loadInstances() {
        const baseParams = {
            sortBy: 'createdAt:desc'
        };
        // API validation caps limit at 100; keep within that and paginate.
        const pageSize = 100;
        if ($scope.filters.status) baseParams.status = $scope.filters.status;
        if ($scope.filters.fromDate) baseParams.fromDate = formatDate($scope.filters.fromDate);
        if ($scope.filters.toDate) baseParams.toDate = formatDate($scope.filters.toDate);

        function fetchPage(offset, acc) {
            const params = angular.extend({}, baseParams, { limit: pageSize, offset: offset });
            return $http.get('/api/bonus/instances', { params: params })
                .then(function (response) {
                    const items = response.data.items || [];
                    const normalized = items.map(normalizeInstance);
                    const combined = acc.concat(normalized);
                    // keep fetching while full page returned to ensure we list everything
                    if (items.length === pageSize) {
                        return fetchPage(offset + pageSize, combined);
                    }
                    return combined;
                });
        }

        return fetchPage(0, [])
            .catch(function (error) {
                console.error('Failed to load bonus instances', error);
                toastr.error(t('Failed to load bonus instances'));
                return [];
            });
    }

    function refreshReport() {
        const seq = ++refreshSeq; // mark this refresh instance
        activeRefreshes += 1;
        $scope.loading = true;
        // Start global progress for this page load
        $rootScope.kernel.loading = 0;

        const personnelId = $scope.filters.personnel ? $scope.filters.personnel._id : null;
        // Run requests in parallel for speed
        return $q.all({
            instances: loadInstances(),
            allocations: loadAllocationsByPersonnel(personnelId)
        }).then(function (result) {
            if (seq !== refreshSeq) return; // a newer refresh started, ignore this result
            const filtered = applyClientFilters(result.instances || []);
            const rows = attachAmountsToInstances(filtered, result.allocations || {}, !!personnelId);
            const withParts = rows.filter(function (r) { return r.category === 'with_parts'; });
            const withoutParts = rows.filter(function (r) { return r.category === 'without_parts'; });
            const others = rows.filter(function (r) { return r.category !== 'with_parts' && r.category !== 'without_parts'; });
            $scope.filteredRows = { with_parts: withParts, without_parts: withoutParts, others: others };
            console.log($scope.filteredRows)
            buildTotals(withParts, withoutParts, others);
            $scope.$applyAsync();
        }).finally(function () {
            activeRefreshes = Math.max(0, activeRefreshes - 1);
            if (activeRefreshes === 0) {
                $scope.$applyAsync(function () {
                    $scope.loading = false;
                    $rootScope.kernel.loading = 100; // mark global spinner as finished
                });
            }
        });
    }

    function scheduleRefresh(delay) {
        if (refreshDebouncePromise) $timeout.cancel(refreshDebouncePromise);
        refreshDebouncePromise = $timeout(function () {
            refreshDebouncePromise = null;
            refreshReport();
        }, typeof delay === 'number' ? delay : 150);
    }

    // Debounced personnel autocomplete
    $scope.searchingPersonnel = false; // Loading indicator flag

    $scope.searchPersonnel = function (query) {
        if (personnelSearchTimeout) {
            $timeout.cancel(personnelSearchTimeout);
            personnelSearchTimeout = null;
        }

        // If query is empty or whitespace, resolve immediately with empty list
        if (!query || !query.trim()) {
            $scope.searchingPersonnel = false;
            return $q.when([]);
        }

        var deferred = $q.defer();

        // Set loading flag
        $scope.searchingPersonnel = true;

        personnelSearchTimeout = $timeout(function () {
            $http.get('/api/personnel/search/' + encodeURIComponent(query.trim()))
                .then(function (response) {
                    var results = response.data || [];
                    // Sort results alphabetically by fname
                    results.sort(function (a, b) {
                        var nameA = (a.fname || '').toLowerCase();
                        var nameB = (b.fname || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                    deferred.resolve(results);
                })
                .catch(function () {
                    deferred.resolve([]);
                })
                .finally(function () {
                    $scope.searchingPersonnel = false;
                });
        }, 800); // wait 800ms after last keystroke

        return deferred.promise;
    };

    $scope.onPersonnelSelected = function (personnel) {
        $scope.filters.personnel = personnel;
        scheduleRefresh(50);
    };

    $scope.resetPersonnel = function () {
        $scope.filters.personnel = null;
        $scope.filters.searchPersonnel = '';
        scheduleRefresh(50);
    };

    $scope.getPersonnelLabel = function (person) {
        if (!person) return 'N/A';
        const displayName = person.fname;
        const identifier = person.identifier || '';
        return [displayName || 'Personnel', identifier].filter(Boolean).join(' • ');
    };

    $scope.applyFilters = function () {
        scheduleRefresh(100);
    };

    $scope.getPeriodLabel = function () {
        const from = formatDate($scope.filters.fromDate);
        const to = formatDate($scope.filters.toDate);
        if (from || to) {
            return (from || '...') + ' au ' + (to || '...');
        }
        return 'Toutes périodes';
    };

    $scope.resetFilters = function () {
        const range = getCurrentYearRange();
        $scope.filters = {
            category: '',
            status: '',
            fromDate: range.from,
            toDate: range.to,
            personnel: null,
            searchPersonnel: ''
        };
        scheduleRefresh(0);
    };

    $scope.exportPdf = function () {
        if (!$scope.filters.personnel || !$scope.filters.personnel._id) {
            toastr.error(t('Sélectionnez un bénéficiaire pour exporter en PDF'));
            return;
        }

        const params = {
            personnelId: $scope.filters.personnel._id
        };
        const from = formatDate($scope.filters.fromDate);
        const to = formatDate($scope.filters.toDate);
        if (from) params.fromDate = from;
        if (to) params.toDate = to;

        // Use a dedicated exporting flag so the main table spinner isn't affected
        $scope.exporting = true;
        $http.get('/api/bonus/personnel/export', {
            params: params,
            responseType: 'arraybuffer',
            headers: { Accept: 'application/pdf' }
        }).then(function (response) {
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const fileName = 'bonus-report-' + ($scope.filters.personnel.identifier || 'beneficiaire') + '.pdf';
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }).catch(function (err) {
            console.error('PDF export failed', err);
            toastr.error(t('Impossible de générer le PDF. Réessayez plus tard.'));
        }).finally(function () {
            $scope.exporting = false;
        });
    };

    function init() {
        // When entering the report page, reset global loading to 0 until first refresh completes
        $rootScope.kernel.loading = 0;
        $http.get('/api/bonus/templates')
            .then(function (response) {
                $scope.templates = response.data || [];
            })
            .catch(function () { toastr.error(t('Failed to load templates')); })
            .finally(function () {
                scheduleRefresh(0);
            });
    }

    init();
}]);
