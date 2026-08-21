import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ConfigProvider,
  Layout, 
  Input, 
  Card, 
  Button, 
  Tooltip, 
  AutoComplete, 
  Spin, 
  message, 
  Typography, 
  Select, 
  Tag, 
  Slider, 
  Popover, 
  Space, 
  Radio 
} from 'antd';
import { 
  AimOutlined, 
  EnvironmentOutlined,
  GlobalOutlined,
  MedicineBoxOutlined,
  FullscreenOutlined,
  CompassOutlined,
  MenuOutlined,
  CloseOutlined,
  FilterOutlined,
  RadarChartOutlined,
  BgColorsOutlined,
  LineOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  CarOutlined,
  ClearOutlined,
  ThunderboltOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { 
  MapContainer, 
  TileLayer, 
  GeoJSON, 
  Marker, 
  Popup, 
  useMap, 
  ScaleControl, 
  Circle, 
  Polyline,
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './App.css';

import { NEPAL_CENTER, NEPAL_BOUNDS, PROVINCE_DATA } from './data/provinces';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Paisa Minimal Theme Tokens
const paisaTheme = {
  token: {
    colorPrimary: '#4f46e5',
    colorPrimaryHover: '#4338ca',
    colorLink: '#4f46e5',
    colorLinkHover: '#4338ca',
    colorSuccess: '#059669',
    colorWarning: '#d97706',
    colorError: '#e11d48',
    colorInfo: '#4f46e5',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8fafc',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 34,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 10,
      headerHeight: 38,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 34,
    },
    Select: {
      borderRadius: 8,
      controlHeight: 34,
    },
    Tag: {
      borderRadiusSM: 6,
    }
  }
};

// Fix Leaflet default icon paths in React environment
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Basemap configurations
const BASEMAPS = {
  voyager: {
    name: 'CartoDB Voyager (Street)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  satellite: {
    name: 'Satellite (Esri Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxZoom: 18
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  dark: {
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  topo: {
    name: 'OpenTopoMap (Terrain)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17
  }
};

// Facility classification helper
function getFacilityCategory(typeStr = '') {
  const t = typeStr.toLowerCase();
  if (t.includes('eye')) return 'eye';
  if (t.includes('private')) return 'private';
  if (t.includes('community')) return 'community';
  return 'government';
}

function getFacilityMeta(typeStr = '') {
  const cat = getFacilityCategory(typeStr);
  switch(cat) {
    case 'eye':
      return { label: 'Eye Hospital', color: '#d97706', iconClass: 'fa-solid fa-eye', tagColor: 'gold' };
    case 'private':
      return { label: 'Private Hospital', color: '#7c3aed', iconClass: 'fa-solid fa-hospital-user', tagColor: 'purple' };
    case 'community':
      return { label: 'Community Hospital', color: '#4f46e5', iconClass: 'fa-solid fa-hand-holding-medical', tagColor: 'geekblue' };
    case 'government':
    default:
      return { label: 'Government Hospital / PHC', color: '#059669', iconClass: 'fa-solid fa-hospital', tagColor: 'green' };
  }
}

// Great-circle Haversine Distance (in km)
function calculateHaversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Choropleth density color steps (Paisa Slate -> Indigo scale)
function getChoroplethColor(count) {
  if (count === 0) return '#f1f5f9';
  if (count <= 2) return '#e0e7ff';
  if (count <= 5) return '#c7d2fe';
  if (count <= 10) return '#818cf8';
  if (count <= 20) return '#4f46e5';
  if (count <= 35) return '#3730a3';
  return '#1e1b4b';
}

function resolveDistrictName(props) {
  if (!props) return 'Unknown';
  const keys = ['DISTRICT', 'district', 'Dist_Name', 'DIST_NAME', 'name', 'NAME'];
  for (const key of keys) {
    if (props[key]) return props[key];
  }
  return 'Unknown';
}

// ----------------------------------------------------
// CHILD COMPONENT: Map Controller & Event Handler
// ----------------------------------------------------
function MapController({ 
  mapRef, 
  setMouseCoords, 
  districtLayerRef, 
  isMeasureMode, 
  onMapClickForMeasure,
  isRadiusMode,
  setRadiusCenter
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useMapEvents({
    mousemove(e) {
      setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    click(e) {
      if (isMeasureMode) {
        onMapClickForMeasure([e.latlng.lat, e.latlng.lng]);
      } else if (isRadiusMode) {
        setRadiusCenter([e.latlng.lat, e.latlng.lng]);
        message.info(`Radius center set to [${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)}]`);
      }
    }
  });

  useEffect(() => {
    if (districtLayerRef.current) {
      districtLayerRef.current.bringToFront();
    }
  }, [districtLayerRef]);

  return null;
}

// ----------------------------------------------------
// CHILD COMPONENT: Leaflet MarkerCluster Layer
// ----------------------------------------------------
function HealthFacilitiesClusterLayer({ facilities, onSelect, clusterGroupRef, userPosition }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
      map.removeLayer(clusterGroupRef.current);
    }

    if (!facilities || facilities.length === 0) return;

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        let govCount = 0;
        let privCount = 0;
        let commCount = 0;
        let eyeCount = 0;

        markers.forEach(m => {
          const c = m.options.facilityCategory;
          if (c === 'eye') eyeCount++;
          else if (c === 'private') privCount++;
          else if (c === 'community') commCount++;
          else govCount++;
        });

        let sizeClass = 'cluster-small';
        let dimension = 36;
        if (count > 40) {
          sizeClass = 'cluster-large';
          dimension = 52;
        } else if (count > 12) {
          sizeClass = 'cluster-medium';
          dimension = 44;
        }

        const breakdownTooltip = `${count} Facilities: ${govCount} Gov, ${privCount} Private, ${commCount + eyeCount} Other`;

        return L.divIcon({
          html: `
            <div class="custom-cluster-badge ${sizeClass}" title="${breakdownTooltip}">
              <div class="cluster-inner-count">
                <span>${count}</span>
              </div>
            </div>
          `,
          className: 'custom-cluster-marker-wrap',
          iconSize: [dimension, dimension],
          iconAnchor: [dimension / 2, dimension / 2]
        });
      }
    });

    clusterGroupRef.current = clusterGroup;

    facilities.forEach(fac => {
      const meta = getFacilityMeta(fac.type);
      const cat = getFacilityCategory(fac.type);

      const divIcon = L.divIcon({
        className: 'custom-facility-marker-container',
        html: `
          <div class="custom-landmark-marker" style="width: 26px; height: 26px;">
            <div class="marker-icon-wrapper" style="width: 22px; height: 22px; background: ${meta.color}; border: 2px solid #ffffff;">
              <i class="${meta.iconClass}"></i>
            </div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const distStr = userPosition ? ` (${calculateHaversine(userPosition[0], userPosition[1], fac.lat, fac.lng).toFixed(1)} km away)` : '';

      const marker = L.marker([fac.lat, fac.lng], { 
        icon: divIcon,
        facilityCategory: cat
      })
      .bindPopup(`
        <div style="min-width: 230px; padding: 4px; font-family: 'Inter', sans-serif;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.68rem; font-weight:700; color:${meta.color}; text-transform:uppercase; letter-spacing:0.04em;">
              <i class="${meta.iconClass}"></i> ${fac.type}
            </span>
          </div>
          <h4 style="margin:0 0 6px 0; font-size:0.88rem; font-weight:700; color:#0f172a; line-height:1.3;">${fac.name}</h4>
          <p style="margin:0 0 10px 0; font-size:0.75rem; color:#64748b;">
            <i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:4px;"></i> ${fac.district} District ${distStr}
          </p>
          <div style="display:flex; gap:6px;">
            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}" 
              target="_blank" 
              rel="noopener noreferrer" 
              style="flex:1; text-align:center; background:#4f46e5; color:white; padding:6px 10px; border-radius:6px; font-size:0.74rem; text-decoration:none; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 1px 2px rgba(79,70,229,0.2);"
            >
              <i class="fa-solid fa-diamond-turn-right"></i> Directions
            </a>
          </div>
        </div>
      `, { closeButton: true })
      .on('click', () => {
        onSelect(fac);
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      if (map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup);
      }
    };
  }, [map, facilities, userPosition, onSelect]);

  return null;
}

// ----------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------
export default function App() {
  const mapRef = useRef(null);
  const districtLayerRef = useRef(null);
  const clusterGroupRef = useRef(null);

  // States: Geo & Data
  const [districtGeoJson, setDistrictGeoJson] = useState(null);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [healthFacilities, setHealthFacilities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  // Search & Navigation
  const [hospitalsSearchQuery, setHospitalsSearchQuery] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [mouseCoords, setMouseCoords] = useState({ lat: null, lng: null });

  // Filtering Controls
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState(null);

  // Map Basemap & Thematic Layers
  const [currentBasemap, setCurrentBasemap] = useState('voyager');
  const [showDensityChoropleth, setShowDensityChoropleth] = useState(false);
  const [shadeOutsideNepal, setShadeOutsideNepal] = useState(true); // Default: Focus Nepal with world shaded grey

  // Proximity / Radius Filter Mode
  const [isRadiusMode, setIsRadiusMode] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const [radiusCenter, setRadiusCenter] = useState(null);

  // Distance Measuring Tool Mode
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  // Responsive & UI states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [collapsed, setCollapsed] = useState(true);

  // GPS geolocation states
  const [userPosition, setUserPosition] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Dedicated "Nearby Hospitals" Mode
  const [nearestHospital, setNearestHospital] = useState(null);
  const [filterNearMeOnly, setFilterNearMeOnly] = useState(false);
  const [nearMeRadiusMax, setNearMeRadiusMax] = useState(30);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map size recalculation on sidebar state toggle
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 250);
    }
  }, [collapsed]);

  // Fetch boundary & facility listings on startup
  useEffect(() => {
    fetch('/nepal-districts-highres.geojson?v=2')
      .then(res => res.json())
      .then(data => {
        setDistrictGeoJson(data);
        setDistrictsLoading(false);
      })
      .catch(() => {
        setDistrictsLoading(false);
        message.error("Failed to load official district boundaries.");
      });

    fetch('/nepal-health-facilities.json?v=2')
      .then(res => res.json())
      .then(data => {
        setHealthFacilities(data);
      })
      .catch(() => message.error("Failed to load hospital listings."));
  }, []);

  // Compute World Mask (Spotlight Nepal by cutting holes for all district polygons)
  const worldMaskGeoJson = useMemo(() => {
    if (!districtGeoJson || !districtGeoJson.features) return null;
    const worldBox = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90]
    ];
    const holes = districtGeoJson.features.map(f => f.geometry.coordinates[0]);
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: 'World Mask' },
        geometry: {
          type: 'Polygon',
          coordinates: [worldBox, ...holes]
        }
      }]
    };
  }, [districtGeoJson]);

  // Check URL params on startup for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const facilityParam = params.get('facility');
    const latParam = params.get('lat');
    const lngParam = params.get('lng');
    const zoomParam = params.get('zoom');

    if (latParam && lngParam && mapRef.current) {
      mapRef.current.setView([parseFloat(latParam), parseFloat(lngParam)], parseInt(zoomParam || '13'));
    }

    if (facilityParam && healthFacilities.length > 0) {
      const found = healthFacilities.find(h => h.name.toLowerCase() === facilityParam.toLowerCase());
      if (found) {
        selectHealthFacility(found);
      }
    }
  }, [healthFacilities]);

  // District facility count map for Choropleth
  const districtFacilityCounts = useMemo(() => {
    const counts = {};
    healthFacilities.forEach(f => {
      const d = (f.district || '').toLowerCase().trim();
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [healthFacilities]);

  // Filtered facilities based on: Type + Province + District + Search + Radius Proximity + Near Me
  const filteredFacilities = useMemo(() => {
    return healthFacilities.filter(fac => {
      if (selectedTypeFilter !== 'all') {
        const cat = getFacilityCategory(fac.type);
        if (cat !== selectedTypeFilter) return false;
      }

      if (selectedProvince) {
        const provData = PROVINCE_DATA[selectedProvince];
        if (provData && !provData.districts.some(d => d.toLowerCase() === (fac.district || '').toLowerCase())) {
          return false;
        }
      }

      if (selectedDistrictFilter) {
        if ((fac.district || '').toLowerCase() !== selectedDistrictFilter.toLowerCase()) {
          return false;
        }
      }

      if (hospitalsSearchQuery) {
        const q = hospitalsSearchQuery.toLowerCase();
        const matchName = (fac.name || '').toLowerCase().includes(q);
        const matchDist = (fac.district || '').toLowerCase().includes(q);
        const matchType = (fac.type || '').toLowerCase().includes(q);
        if (!matchName && !matchDist && !matchType) return false;
      }

      if (isRadiusMode && radiusCenter) {
        const dist = calculateHaversine(radiusCenter[0], radiusCenter[1], fac.lat, fac.lng);
        if (dist > radiusKm) return false;
      }

      if (filterNearMeOnly && userPosition) {
        const dist = calculateHaversine(userPosition[0], userPosition[1], fac.lat, fac.lng);
        if (dist > nearMeRadiusMax) return false;
      }

      return true;
    }).map(fac => {
      const refPoint = userPosition || radiusCenter;
      const distanceKm = refPoint ? calculateHaversine(refPoint[0], refPoint[1], fac.lat, fac.lng) : null;
      return { ...fac, distanceKm };
    }).sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });
  }, [
    healthFacilities, 
    selectedTypeFilter, 
    selectedProvince, 
    selectedDistrictFilter, 
    hospitalsSearchQuery, 
    isRadiusMode, 
    radiusCenter, 
    radiusKm, 
    userPosition,
    filterNearMeOnly,
    nearMeRadiusMax
  ]);

  // Standard or Choropleth district styles
  function getDistrictStyle(feature) {
    const distName = resolveDistrictName(feature.properties);
    const isSelected = selectedEntity && selectedEntity.type === 'district' && selectedEntity.name.toLowerCase() === distName.toLowerCase();
    
    if (showDensityChoropleth) {
      const count = districtFacilityCounts[distName.toLowerCase().trim()] || 0;
      return {
        color: isSelected ? '#e11d48' : '#ffffff',
        weight: isSelected ? 3 : 1,
        opacity: 0.9,
        fillColor: getChoroplethColor(count),
        fillOpacity: 0.75
      };
    }

    return {
      color: isSelected ? '#e11d48' : '#6366f1',
      weight: isSelected ? 2.5 : 1,
      opacity: isSelected ? 0.9 : 0.6,
      fillColor: '#4f46e5',
      fillOpacity: isSelected ? 0.15 : 0.015
    };
  }

  const onEachDistrict = (feature, layer) => {
    const distName = resolveDistrictName(feature.properties);
    const count = districtFacilityCounts[distName.toLowerCase().trim()] || 0;

    layer.on({
      mouseover: (e) => {
        const lyr = e.target;
        lyr.setStyle({
          color: '#4f46e5',
          weight: 2.2,
          fillOpacity: showDensityChoropleth ? 0.9 : 0.1
        });
        lyr.bringToFront();
      },
      mouseout: (e) => {
        if (districtLayerRef.current) {
          districtLayerRef.current.resetStyle(e.target);
        }
      },
      click: () => {
        selectDistrict(distName, layer, count);
      }
    });

    const tooltipText = showDensityChoropleth 
      ? `<strong>${distName}</strong><br/>🏥 ${count} Facilities` 
      : distName;
    layer.bindTooltip(tooltipText, { sticky: true, direction: 'top' });
  };

  function selectDistrict(distName, layer, count = 0) {
    setSelectedEntity({
      type: 'district',
      name: distName,
      count: count || districtFacilityCounts[distName.toLowerCase().trim()] || 0,
      description: `${distName} is one of Nepal's 77 administrative districts.`
    });

    if (layer && mapRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [40, 40] });
    }

    if (isMobile) {
      setCollapsed(true);
    }
  }

  const selectHealthFacility = useCallback((facility) => {
    setSelectedEntity({
      type: 'health_facility',
      name: facility.name,
      facilityType: facility.type,
      district: facility.district,
      coords: [facility.lat, facility.lng]
    });

    if (isMobile) {
      setCollapsed(true);
    }
  }, [isMobile]);

  // GPS geolocation lookup
  function locateUser(callback) {
    if (!navigator.geolocation) {
      message.error("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    message.loading({ content: "Detecting your current GPS location...", key: 'gps-locate', duration: 0 });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setUserPosition([lat, lng]);
        setUserAccuracy(position.coords.accuracy);
        setGpsLoading(false);
        message.success({ content: "GPS Position acquired!", key: 'gps-locate', duration: 2 });

        if (isRadiusMode) {
          setRadiusCenter([lat, lng]);
        }

        setSelectedEntity({
          type: 'user_gps',
          lat: lat,
          lng: lng,
          accuracy: position.coords.accuracy
        });

        if (callback) {
          callback([lat, lng]);
        } else if (mapRef.current) {
          mapRef.current.setView([lat, lng], 14);
        }
      },
      (error) => {
        setGpsLoading(false);
        message.error({ content: `GPS location failed: ${error.message}`, key: 'gps-locate', duration: 3 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // "Find Nearby Hospitals from My Location" Action
  function findNearbyHospitalsFromMyLocation() {
    const proceedWithPos = (pos) => {
      if (!healthFacilities || healthFacilities.length === 0) return;

      let closest = null;
      let minDistance = Infinity;

      healthFacilities.forEach(f => {
        const dist = calculateHaversine(pos[0], pos[1], f.lat, f.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closest = { ...f, distanceKm: dist };
        }
      });

      if (closest) {
        setNearestHospital(closest);
        setFilterNearMeOnly(true);
        setCollapsed(false);

        if (mapRef.current) {
          const bounds = L.latLngBounds([pos, [closest.lat, closest.lng]]);
          mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
        }

        message.success({
          content: `Nearest: ${closest.name} (${closest.distanceKm.toFixed(1)} km away)`,
          duration: 4
        });
      }
    };

    if (userPosition) {
      proceedWithPos(userPosition);
    } else {
      locateUser((pos) => {
        proceedWithPos(pos);
      });
    }
  }

  // Measurement tool handlers
  function handleMapClickForMeasure(latlng) {
    setMeasurePoints(prev => [...prev, latlng]);
  }

  const totalMeasuredDistance = useMemo(() => {
    if (measurePoints.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      sum += calculateHaversine(
        measurePoints[i][0], 
        measurePoints[i][1], 
        measurePoints[i+1][0], 
        measurePoints[i+1][1]
      );
    }
    return sum;
  }, [measurePoints]);

  // Autocomplete search suggestions mapping
  const searchTargets = useMemo(() => {
    const list = [];
    if (districtGeoJson) {
      districtGeoJson.features.forEach(feat => {
        const dist = resolveDistrictName(feat.properties);
        if (dist && !list.some(x => x.value === dist)) {
          list.push({ value: dist, type: 'district' });
        }
      });
    }
    healthFacilities.forEach(fac => {
      list.push({ value: fac.name, type: 'facility', meta: fac });
    });
    return list;
  }, [districtGeoJson, healthFacilities]);

  const [autocompleteOptions, setAutocompleteOptions] = useState([]);

  function onSearchChange(val) {
    setSearchVal(val);
    if (!val) {
      setAutocompleteOptions([]);
      return;
    }
    const filtered = searchTargets
      .filter(t => t.value.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 10)
      .map(item => ({
        value: item.value,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{item.value}</span>
            <Tag color={item.type === 'district' ? 'blue' : 'red'} style={{ fontSize: '0.65rem' }}>
              {item.type.toUpperCase()}
            </Tag>
          </div>
        ),
        rawData: item
      }));
    setAutocompleteOptions(filtered);
  }

  function onSearchSelect(value, option) {
    const item = option.rawData;
    setSearchVal(value);
    
    if (item.type === 'district') {
      selectDistrict(item.value, null);
      if (districtLayerRef.current) {
        districtLayerRef.current.eachLayer(layer => {
          if (resolveDistrictName(layer.feature.properties).toLowerCase() === item.value.toLowerCase()) {
            mapRef.current.fitBounds(layer.getBounds(), { maxZoom: 11 });
          }
        });
      }
    } else if (item.type === 'facility') {
      const marker = getMarkerByCoords(item.meta.lat, item.meta.lng);
      if (marker && clusterGroupRef.current) {
        mapRef.current.setView([item.meta.lat, item.meta.lng], 15);
        clusterGroupRef.current.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      } else {
        mapRef.current?.setView([item.meta.lat, item.meta.lng], 15);
      }
      selectHealthFacility(item.meta);
    }

    if (isMobile) {
      setCollapsed(true);
    }
  }

  function getMarkerByCoords(lat, lng) {
    if (!clusterGroupRef.current) return null;
    let found = null;
    clusterGroupRef.current.eachLayer(layer => {
      const pos = layer.getLatLng();
      if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
        found = layer;
      }
    });
    return found;
  }

  // Export Data Feature (CSV / GeoJSON)
  function exportData(format = 'csv') {
    if (filteredFacilities.length === 0) {
      message.warning("No facilities match the current filters to export.");
      return;
    }

    if (format === 'csv') {
      const headers = ['Name', 'Type', 'District', 'Latitude', 'Longitude', 'Distance_km'];
      const rows = filteredFacilities.map(f => [
        `"${(f.name || '').replace(/"/g, '""')}"`,
        `"${(f.type || '').replace(/"/g, '""')}"`,
        `"${(f.district || '').replace(/"/g, '""')}"`,
        f.lat,
        f.lng,
        f.distanceKm ? f.distanceKm.toFixed(2) : ''
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `nepal_health_facilities_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Exported ${filteredFacilities.length} facilities to CSV!`);
    } else {
      const geojsonObj = {
        type: "FeatureCollection",
        features: filteredFacilities.map(f => ({
          type: "Feature",
          properties: {
            name: f.name,
            type: f.type,
            district: f.district
          },
          geometry: {
            type: "Point",
            coordinates: [f.lng, f.lat]
          }
        }))
      };
      const blob = new Blob([JSON.stringify(geojsonObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nepal_health_facilities_${Date.now()}.geojson`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success(`Exported ${filteredFacilities.length} facilities to GeoJSON!`);
    }
  }

  // Share View URL Link
  function copyShareLink() {
    const center = mapRef.current ? mapRef.current.getCenter() : { lat: NEPAL_CENTER[0], lng: NEPAL_CENTER[1] };
    const zoom = mapRef.current ? mapRef.current.getZoom() : 8;
    const url = new URL(window.location.href);
    url.searchParams.set('lat', center.lat.toFixed(4));
    url.searchParams.set('lng', center.lng.toFixed(4));
    url.searchParams.set('zoom', zoom.toString());
    if (selectedEntity && selectedEntity.type === 'health_facility') {
      url.searchParams.set('facility', selectedEntity.name);
    }
    
    navigator.clipboard.writeText(url.toString());
    message.success("Shareable map view URL copied to clipboard!");
  }

  return (
    <ConfigProvider theme={paisaTheme}>
      <Layout>
        {/* ----------------------------------------------------
            SIDEBAR: CONTROLS, FILTERS & LIST
            ---------------------------------------------------- */}
        <Sider width={380} collapsedWidth={0} collapsible collapsed={collapsed} theme="light" trigger={null}>
          {/* Brand Header */}
          <div className="brand-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title className="brand-title" level={4} style={{ margin: 0 }}>
                <MedicineBoxOutlined style={{ color: '#4f46e5' }} /> Nepal Health Map
              </Title>
              <p className="brand-subtitle">Health Insurance Board (HIB) Explorer</p>
            </div>
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={() => setCollapsed(true)} 
              style={{ fontSize: '0.9rem', color: '#64748b' }}
            />
          </div>

          {/* Prominent "Find Hospitals Near Me" Action Bar */}
          <div style={{ marginBottom: 10 }}>
            <Button 
              className="locate-main-btn"
              type="primary" 
              block 
              icon={<ThunderboltOutlined />}
              loading={gpsLoading}
              onClick={findNearbyHospitalsFromMyLocation}
            >
              Locate Nearby Hospitals from My Location
            </Button>
          </div>

          {/* Global Autocomplete */}
          <AutoComplete
            style={{ width: '100%', marginBottom: 10 }}
            options={autocompleteOptions}
            value={searchVal}
            onSearch={onSearchChange}
            onSelect={onSearchSelect}
            placeholder="Search districts or hospitals..."
            allowClear
          />

          {/* Near Me Active Filter Header Banner */}
          {filterNearMeOnly && userPosition && (
            <div style={{
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4338ca' }}>
                  <AimOutlined style={{ marginRight: 4 }} /> Nearby Mode Active (Sorted by Distance)
                </span>
                <Button 
                  type="link" 
                  size="small" 
                  onClick={() => {
                    setFilterNearMeOnly(false);
                    setNearestHospital(null);
                  }}
                  style={{ padding: 0, height: 'auto', fontSize: '0.72rem', color: '#6366f1' }}
                >
                  Clear Near Me
                </Button>
              </div>
              
              {/* Quick Radius Filter for Near Me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Within:</span>
                <Radio.Group 
                  size="small" 
                  value={nearMeRadiusMax} 
                  onChange={(e) => setNearMeRadiusMax(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value={10}>10 km</Radio.Button>
                  <Radio.Button value={25}>25 km</Radio.Button>
                  <Radio.Button value={50}>50 km</Radio.Button>
                  <Radio.Button value={9999}>All</Radio.Button>
                </Radio.Group>
              </div>
            </div>
          )}

          {/* Interactive Filtering Panel */}
          <div className="sidebar-filters-box">
            <div className="filter-heading">
              <span><FilterOutlined /> Facility Category</span>
              <span style={{ fontSize: '0.68rem', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }} onClick={() => {
                setSelectedTypeFilter('all');
                setSelectedProvince(null);
                setSelectedDistrictFilter(null);
                setHospitalsSearchQuery('');
                setFilterNearMeOnly(false);
                setNearestHospital(null);
              }}>
                Reset All
              </span>
            </div>

            <div className="facility-type-chips">
              <div 
                className={`type-chip ${selectedTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('all')}
              >
                All ({healthFacilities.length})
              </div>
              <div 
                className={`type-chip gov ${selectedTypeFilter === 'government' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('government')}
              >
                Govt ({healthFacilities.filter(h => getFacilityCategory(h.type) === 'government').length})
              </div>
              <div 
                className={`type-chip priv ${selectedTypeFilter === 'private' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('private')}
              >
                Private ({healthFacilities.filter(h => getFacilityCategory(h.type) === 'private').length})
              </div>
              <div 
                className={`type-chip comm ${selectedTypeFilter === 'community' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('community')}
              >
                Community ({healthFacilities.filter(h => getFacilityCategory(h.type) === 'community').length})
              </div>
              <div 
                className={`type-chip eye ${selectedTypeFilter === 'eye' ? 'active' : ''}`}
                onClick={() => setSelectedTypeFilter('eye')}
              >
                Eye Care ({healthFacilities.filter(h => getFacilityCategory(h.type) === 'eye').length})
              </div>
            </div>

            {/* Cascading Province & District Dropdowns */}
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <Select 
                placeholder="Province" 
                size="small" 
                allowClear 
                style={{ flex: 1 }}
                value={selectedProvince}
                onChange={(val) => {
                  setSelectedProvince(val);
                  setSelectedDistrictFilter(null);
                  if (val && PROVINCE_DATA[val]) {
                    const pDistricts = PROVINCE_DATA[val].districts;
                    if (districtLayerRef.current) {
                      let group = L.featureGroup();
                      districtLayerRef.current.eachLayer(layer => {
                        if (pDistricts.some(d => d.toLowerCase() === resolveDistrictName(layer.feature.properties).toLowerCase())) {
                          group.addLayer(layer);
                        }
                      });
                      if (group.getLayers().length > 0 && mapRef.current) {
                        mapRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
                      }
                    }
                  }
                }}
              >
                {Object.entries(PROVINCE_DATA).map(([id, prov]) => (
                  <Option key={id} value={parseInt(id)}>{prov.name}</Option>
                ))}
              </Select>

              <Select
                placeholder="District"
                size="small"
                allowClear
                showSearch
                style={{ flex: 1 }}
                value={selectedDistrictFilter}
                onChange={(val) => {
                  setSelectedDistrictFilter(val);
                  if (val && districtLayerRef.current) {
                    districtLayerRef.current.eachLayer(layer => {
                      if (resolveDistrictName(layer.feature.properties).toLowerCase() === val.toLowerCase()) {
                        mapRef.current?.fitBounds(layer.getBounds(), { maxZoom: 11 });
                        selectDistrict(val, layer);
                      }
                    });
                  }
                }}
              >
                {(selectedProvince ? PROVINCE_DATA[selectedProvince].districts : Object.values(PROVINCE_DATA).flatMap(p => p.districts))
                  .sort()
                  .map(d => (
                    <Option key={d} value={d}>{d}</Option>
                  ))
                }
              </Select>
            </div>
          </div>

          {/* Selected Profile Details Card */}
          {selectedEntity && (
            <div style={{ marginBottom: 10 }}>
              {selectedEntity.type === 'district' && (
                <Card size="small" title={<span style={{ color: '#0f172a' }}><GlobalOutlined style={{ color: '#4f46e5', marginRight: 6 }} /> District Profile</span>}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={5} style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>{selectedEntity.name}</Title>
                    <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 600 }}>{selectedEntity.count} Hospitals</Tag>
                  </div>
                  <Paragraph style={{ color: '#64748b', fontSize: '0.78rem', margin: '6px 0 0 0' }}>
                    {selectedEntity.description}
                  </Paragraph>
                </Card>
              )}

              {selectedEntity.type === 'health_facility' && (
                <Card 
                  size="small" 
                  title={<span style={{ color: '#0f172a' }}><MedicineBoxOutlined style={{ color: '#4f46e5', marginRight: 6 }} /> Selected Facility</span>} 
                >
                  <Title level={5} style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>{selectedEntity.name}</Title>
                  <div style={{ marginTop: 8 }}>
                    <div className="detail-row">
                      <span className="detail-label">Classification</span>
                      <Tag color={getFacilityMeta(selectedEntity.facilityType).tagColor} style={{ margin: 0, borderRadius: 6 }}>
                        {selectedEntity.facilityType}
                      </Tag>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">District</span>
                      <span className="detail-value">{selectedEntity.district}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Coordinates</span>
                      <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#64748b' }}>
                        {selectedEntity.coords[0].toFixed(5)}, {selectedEntity.coords[1].toFixed(5)}
                      </span>
                    </div>
                    {userPosition && (
                      <div className="detail-row">
                        <span className="detail-label">Distance from you</span>
                        <span className="detail-value" style={{ color: '#059669' }}>
                          {calculateHaversine(userPosition[0], userPosition[1], selectedEntity.coords[0], selectedEntity.coords[1]).toFixed(1)} km
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <Button 
                      type="primary" 
                      size="small" 
                      icon={<FullscreenOutlined />}
                      onClick={() => mapRef.current?.setView(selectedEntity.coords, 16)}
                      style={{ flex: 1 }}
                    >
                      Zoom
                    </Button>
                    <Button 
                      size="small" 
                      icon={<CarOutlined />} 
                      href={`https://www.google.com/maps/dir/?api=1${userPosition ? `&origin=${userPosition[0]},${userPosition[1]}` : ''}&destination=${selectedEntity.coords[0]},${selectedEntity.coords[1]}`}
                      target="_blank"
                      style={{ flex: 1, borderColor: '#c7d2fe', color: '#4f46e5', background: '#eef2ff', fontWeight: 600 }}
                    >
                      Directions
                    </Button>
                    <Button 
                      size="small"
                      onClick={() => {
                        setSelectedEntity(null);
                        mapRef.current?.setView(NEPAL_CENTER, 7.3);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </Card>
              )}

              {selectedEntity.type === 'user_gps' && (
                <Card size="small" title={<span style={{ color: '#0f172a' }}><AimOutlined style={{ color: '#4f46e5', marginRight: 6 }} /> GPS Position</span>}>
                  <div className="detail-row">
                    <span className="detail-label">Lat / Lng</span>
                    <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                      {selectedEntity.lat.toFixed(5)}, {selectedEntity.lng.toFixed(5)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Accuracy</span>
                    <span className="detail-value">~{selectedEntity.accuracy ? selectedEntity.accuracy.toFixed(1) : '10'} meters</span>
                  </div>
                </Card>
              )}
            </div>
          )}

        {/* Scrollable Hospitals List */}
        <div className="hospitals-list-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text strong style={{ fontSize: '0.82rem' }}>
              {filterNearMeOnly ? `Nearby Hospitals (${filteredFacilities.length})` : `Facilities (${filteredFacilities.length})`}
            </Text>
            <Space size={4}>
              <Tooltip title="Export to CSV">
                <Button size="small" icon={<DownloadOutlined />} onClick={() => exportData('csv')}>CSV</Button>
              </Tooltip>
              <Tooltip title="Export GeoJSON">
                <Button size="small" onClick={() => exportData('geojson')}>GeoJSON</Button>
              </Tooltip>
            </Space>
          </div>

          <Input
            style={{ marginBottom: 8 }}
            placeholder="Quick search by name or district..."
            value={hospitalsSearchQuery}
            onChange={(e) => setHospitalsSearchQuery(e.target.value)}
            allowClear
            size="small"
          />

          <div className="hospitals-scroll-list">
            {filteredFacilities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#8c8c8c' }}>
                <MedicineBoxOutlined style={{ fontSize: '2rem', color: '#d9d9d9', marginBottom: 8 }} />
                <div>No health facilities found matching your criteria.</div>
              </div>
            ) : (
              filteredFacilities.map((facility) => {
                const isSelected = selectedEntity && selectedEntity.type === 'health_facility' && selectedEntity.name === facility.name;
                const isClosest = nearestHospital && nearestHospital.name === facility.name;
                const meta = getFacilityMeta(facility.type);

                return (
                  <div 
                    key={facility.name}
                    className={`hospital-item-card ${isSelected ? 'selected' : ''} ${isClosest ? 'closest-highlight' : ''}`}
                    onClick={() => {
                      mapRef.current?.setView([facility.lat, facility.lng], 15);
                      const marker = getMarkerByCoords(facility.lat, facility.lng);
                      if (marker && clusterGroupRef.current) {
                        clusterGroupRef.current.zoomToShowLayer(marker, () => {
                          marker.openPopup();
                        });
                      }
                      selectHealthFacility(facility);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="hospital-item-name">
                        {isClosest && <Tag color="error" style={{ fontSize: '0.62rem', padding: '0 4px', marginRight: 4 }}>CLOSEST</Tag>}
                        {facility.name}
                      </div>
                      {facility.distanceKm != null && (
                        <span className="distance-badge">{facility.distanceKm.toFixed(1)} km</span>
                      )}
                    </div>
                    <div className="hospital-item-meta">
                      <span>
                        <Tag color={meta.tagColor} style={{ fontSize: '0.65rem', padding: '0 4px', lineHeight: '16px', margin: '0 4px 0 0' }}>
                          {facility.type}
                        </Tag>
                        {facility.district}
                      </span>
                      <span className="hospital-item-coords">{facility.lat.toFixed(3)}, {facility.lng.toFixed(3)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Sider>

      {/* ----------------------------------------------------
          RIGHT SIDE: LEAFLET MAP & INTERACTIVE CONTROLS
          ---------------------------------------------------- */}
      <Content>
        {/* Loading overlay for district boundaries */}
        {districtsLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <Spin size="large" style={{ marginBottom: 12 }} />
            <Text strong style={{ color: '#1890ff' }}>Loading official Nepal boundaries and health facilities...</Text>
          </div>
        )}

        {/* Sidebar Hamburger Button (when collapsed) */}
        {collapsed && (
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(false)}
            title="Open Hospital Search & Filters"
          >
            <MenuOutlined />
          </button>
        )}

        {/* Active Mode Notification Toasts */}
        {isMeasureMode && (
          <div className="map-status-toast">
            <LineOutlined style={{ color: '#4f46e5' }} />
            <span>Click map points to measure distance: <strong style={{ color: '#0f172a' }}>{totalMeasuredDistance.toFixed(2)} km</strong> ({measurePoints.length} points)</span>
            <Button size="small" danger onClick={() => setMeasurePoints([])} icon={<ClearOutlined />}>Clear</Button>
            <Button size="small" type="primary" onClick={() => { setIsMeasureMode(false); setMeasurePoints([]); }}>Done</Button>
          </div>
        )}

        {isRadiusMode && (
          <div className="map-status-toast">
            <RadarChartOutlined style={{ color: '#059669' }} />
            <span>Click map to set radius center (Radius: <strong style={{ color: '#0f172a' }}>{radiusKm} km</strong>)</span>
            <Slider 
              min={5} 
              max={100} 
              step={5} 
              value={radiusKm} 
              onChange={setRadiusKm} 
              style={{ width: 100, margin: '0 8px' }} 
            />
            <Button size="small" onClick={() => setIsRadiusMode(false)}>Close</Button>
          </div>
        )}

        {/* Floating Nearest Hospital Alert Banner */}
        {nearestHospital && userPosition && (
          <div className="map-status-toast" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
            <MedicineBoxOutlined style={{ color: '#e11d48', fontSize: '1rem' }} />
            <span>
              Nearest Hospital: <strong style={{ color: '#0f172a' }}>{nearestHospital.name}</strong> (~{nearestHospital.distanceKm.toFixed(1)} km)
            </span>
            <Button 
              size="small" 
              type="primary" 
              danger 
              icon={<CarOutlined />}
              href={`https://www.google.com/maps/dir/?api=1&origin=${userPosition[0]},${userPosition[1]}&destination=${nearestHospital.lat},${nearestHospital.lng}`}
              target="_blank"
            >
              Directions
            </Button>
            <Button size="small" onClick={() => setNearestHospital(null)}>Dismiss</Button>
          </div>
        )}

        {/* Main Leaflet Map */}
        <MapContainer
          center={NEPAL_CENTER}
          zoom={7.3}
          minZoom={6}
          maxZoom={18}
          maxBounds={NEPAL_BOUNDS}
          maxBoundsViscosity={0.8}
          zoomControl={false}
          renderer={L.canvas()}
        >
          {/* Active Basemap Layer */}
          <TileLayer
            key={currentBasemap}
            url={BASEMAPS[currentBasemap].url}
            attribution={BASEMAPS[currentBasemap].attribution}
            maxZoom={BASEMAPS[currentBasemap].maxZoom}
          />

          <ScaleControl position="bottomright" imperial={false} />

          <MapController
            mapRef={mapRef}
            setMouseCoords={setMouseCoords}
            districtLayerRef={districtLayerRef}
            isMeasureMode={isMeasureMode}
            onMapClickForMeasure={handleMapClickForMeasure}
            isRadiusMode={isRadiusMode}
            setRadiusCenter={setRadiusCenter}
          />

          {/* World Shade / Nepal Spotlight Mask Layer */}
          {shadeOutsideNepal && worldMaskGeoJson && (
            <GeoJSON
              data={worldMaskGeoJson}
              style={{
                fillColor: '#0f172a', // Deep slate grey mask
                fillOpacity: 0.65,
                weight: 1,
                color: '#1e293b',
                stroke: false
              }}
              key="nepal-world-mask-layer"
            />
          )}

          {/* District boundaries GeoJSON layer */}
          {districtGeoJson && (
            <GeoJSON
              data={districtGeoJson}
              style={getDistrictStyle}
              onEachFeature={onEachDistrict}
              ref={districtLayerRef}
              key={`districts-${showDensityChoropleth ? 'density' : 'normal'}-${selectedEntity?.name || 'none'}`}
            />
          )}

          {/* Clustered Health Facilities layer */}
          <HealthFacilitiesClusterLayer
            facilities={filteredFacilities}
            onSelect={selectHealthFacility}
            clusterGroupRef={clusterGroupRef}
            userPosition={userPosition}
          />

          {/* GPS Location marker & accuracy circle */}
          {userPosition && (
            <>
              <Marker
                position={userPosition}
                icon={L.divIcon({
                  className: 'gps-user-marker-container',
                  html: `
                    <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
                      <div class="user-pulse-wave"></div>
                      <div style="position:absolute; width:14px; height:14px; border-radius:50%; background:#4f46e5; border:2.5px solid #ffffff; box-shadow:0 0 10px rgba(79,70,229,0.8); z-index:2;"></div>
                    </div>
                  `,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14]
                })}
              >
                <Popup closeButton={false}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', fontFamily: 'var(--font-sans)' }}>
                    <AimOutlined style={{ color: '#4f46e5', marginRight: 4 }} /> Your GPS Location
                  </div>
                </Popup>
              </Marker>
              
              {userAccuracy && (
                <Circle
                  center={userPosition}
                  radius={userAccuracy}
                  pathOptions={{
                    color: '#4f46e5',
                    fillColor: '#4f46e5',
                    fillOpacity: 0.08,
                    weight: 1.5,
                    dashArray: '4, 4'
                  }}
                />
              )}
            </>
          )}

          {/* Direct Line to Nearest Hospital */}
          {userPosition && nearestHospital && (
            <Polyline
              positions={[userPosition, [nearestHospital.lat, nearestHospital.lng]]}
              pathOptions={{
                color: '#e11d48',
                weight: 2.5,
                dashArray: '6, 6'
              }}
            />
          )}

          {/* Proximity / Radius Circle */}
          {isRadiusMode && radiusCenter && (
            <>
              <Marker position={radiusCenter} />
              <Circle
                center={radiusCenter}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#4f46e5',
                  fillColor: '#4f46e5',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6, 6'
                }}
              />
            </>
          )}

          {/* Measurement Distance Line */}
          {isMeasureMode && measurePoints.length > 0 && (
            <>
              <Polyline 
                positions={measurePoints} 
                pathOptions={{ color: '#e11d48', weight: 2.5, dashArray: '5, 5' }} 
              />
              {measurePoints.map((pt, idx) => (
                <Marker 
                  key={idx} 
                  position={pt} 
                  icon={L.divIcon({
                    html: `<div style="width:10px;height:10px;background:#e11d48;border:2px solid white;border-radius:50%;"></div>`,
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                  })}
                />
              ))}
            </>
          )}
        </MapContainer>

        {/* Floating Tool Controls Bar */}
        <div className="map-floating-bar">
          {/* Quick Find Nearest Hospital Button */}
          <Tooltip title="Find Nearest Hospitals to Me" placement="left">
            <button 
              className={`floating-bar-btn ${filterNearMeOnly ? 'active' : ''}`}
              onClick={findNearbyHospitalsFromMyLocation}
              style={{ color: '#e11d48' }}
            >
              <ThunderboltOutlined />
            </button>
          </Tooltip>

          {/* Shade Outside Nepal / Focus Spotlight Toggle */}
          <Tooltip title={shadeOutsideNepal ? "Unshade Outside Nepal (Show Full World)" : "Shade Outside Nepal (Focus Nepal)"} placement="left">
            <button 
              className={`floating-bar-btn ${shadeOutsideNepal ? 'active' : ''}`}
              onClick={() => {
                setShadeOutsideNepal(!shadeOutsideNepal);
                message.info(!shadeOutsideNepal ? "Shading rest of the world (Focusing Nepal)" : "Full map view enabled");
              }}
            >
              <EyeOutlined />
            </button>
          </Tooltip>

          {/* Basemap Switcher Popover */}
          <Popover 
            placement="leftTop" 
            title={<span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8rem' }}>Choose Basemap</span>} 
            trigger="click"
            content={
              <div className="basemap-picker-grid">
                {Object.entries(BASEMAPS).map(([key, bm]) => (
                  <div 
                    key={key} 
                    className={`basemap-option ${currentBasemap === key ? 'selected' : ''}`}
                    onClick={() => setCurrentBasemap(key)}
                  >
                    <div>{bm.name.split(' ')[0]}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{bm.name.includes('(') ? bm.name.split('(')[1].replace(')', '') : ''}</div>
                  </div>
                ))}
              </div>
            }
          >
            <button className="floating-bar-btn" title="Change Basemap">
              <BgColorsOutlined />
            </button>
          </Popover>

          {/* GPS Locate Button */}
          <Tooltip title="Lock My GPS Position" placement="left">
            <button 
              className={`floating-bar-btn ${gpsLoading ? 'active' : ''}`}
              onClick={() => locateUser()}
              disabled={gpsLoading}
            >
              {gpsLoading ? <Spin size="small" /> : <AimOutlined />}
            </button>
          </Tooltip>

          {/* Radius / Near Me Mode Toggle */}
          <Tooltip title="Proximity / Near Me Radius Finder" placement="left">
            <button 
              className={`floating-bar-btn ${isRadiusMode ? 'active' : ''}`}
              onClick={() => {
                const next = !isRadiusMode;
                setIsRadiusMode(next);
                if (next && !radiusCenter) {
                  setRadiusCenter(userPosition || NEPAL_CENTER);
                }
              }}
            >
              <RadarChartOutlined />
            </button>
          </Tooltip>

          {/* District Density Choropleth Toggle */}
          <Tooltip title="Toggle Hospital Density Choropleth" placement="left">
            <button 
              className={`floating-bar-btn ${showDensityChoropleth ? 'active' : ''}`}
              onClick={() => setShowDensityChoropleth(!showDensityChoropleth)}
            >
              <GlobalOutlined />
            </button>
          </Tooltip>

          {/* Distance Ruler Measurement Mode */}
          <Tooltip title="Measure Distance Tool" placement="left">
            <button 
              className={`floating-bar-btn ${isMeasureMode ? 'active' : ''}`}
              onClick={() => {
                setIsMeasureMode(!isMeasureMode);
                setMeasurePoints([]);
              }}
            >
              <LineOutlined />
            </button>
          </Tooltip>

          {/* Reset / Fit Nepal Bounds */}
          <Tooltip title="Fit Full Nepal Bounds" placement="left">
            <button 
              className="floating-bar-btn"
              onClick={() => {
                setSelectedEntity(null);
                setNearestHospital(null);
                setFilterNearMeOnly(false);
                mapRef.current?.setView(NEPAL_CENTER, 7.3);
              }}
            >
              <CompassOutlined />
            </button>
          </Tooltip>

          {/* Share View URL */}
          <Tooltip title="Share Map View" placement="left">
            <button className="floating-bar-btn" onClick={copyShareLink}>
              <ShareAltOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Choropleth Legend (visible when density mode is enabled) */}
        {showDensityChoropleth && (
          <div className="choropleth-legend">
            <div className="choropleth-legend-title">Hospitals per District</div>
            <div className="choropleth-scale">
              <div className="choropleth-swatch" style={{ background: '#f1f5f9' }} title="0" />
              <div className="choropleth-swatch" style={{ background: '#e0e7ff' }} title="1-2" />
              <div className="choropleth-swatch" style={{ background: '#c7d2fe' }} title="3-5" />
              <div className="choropleth-swatch" style={{ background: '#818cf8' }} title="6-10" />
              <div className="choropleth-swatch" style={{ background: '#4f46e5' }} title="11-20" />
              <div className="choropleth-swatch" style={{ background: '#3730a3' }} title="21-35" />
              <div className="choropleth-swatch" style={{ background: '#1e1b4b' }} title="35+" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginTop: 3 }}>
              <span>0</span>
              <span>10</span>
              <span>35+</span>
            </div>
          </div>
        )}

        {/* Real-time coordinates HUD display */}
        <div id="coordinates-display">
          <EnvironmentOutlined style={{ marginRight: 4 }} />
          Lat: <span>{mouseCoords.lat ? mouseCoords.lat.toFixed(5) : '--'}</span> | Lng: <span>{mouseCoords.lng ? mouseCoords.lng.toFixed(5) : '--'}</span>
        </div>
      </Content>
    </Layout>
  </ConfigProvider>
  );
}
