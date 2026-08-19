import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Layout, Input, Card, Button, Tooltip, AutoComplete, Spin, message, Typography } from 'antd';
import { 
  AimOutlined, 
  EnvironmentOutlined,
  GlobalOutlined,
  MedicineBoxOutlined,
  FullscreenOutlined,
  CompassOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap, ScaleControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './App.css';

// Import center and bounds from provinces config
import { NEPAL_CENTER, NEPAL_BOUNDS } from './data/provinces';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

// Fix Leaflet default icon paths in React environment
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ----------------------------------------------------
// CHILD COMPONENT: Map Controller & Event Handler
// ----------------------------------------------------
function MapController({ mapRef, setMouseCoords, districtLayerRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    
    // Mouse coords handler
    const onMouseMove = (e) => {
      setMouseCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    
    map.on('mousemove', onMouseMove);
    return () => {
      map.off('mousemove', onMouseMove);
    };
  }, [map, mapRef, setMouseCoords]);

  // Keep district outlines clearly layered on top of basemap
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
function HealthFacilitiesClusterLayer({ facilities, onSelect, clusterGroupRef }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !facilities || facilities.length === 0) return;

    // Standard Leaflet MarkerCluster group (default styles)
    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 45
    });

    clusterGroupRef.current = clusterGroup;

    facilities.forEach(fac => {
      // Red hospital icon marker wrapper
      const divIcon = L.divIcon({
        className: 'custom-facility-marker-container',
        html: `
          <div class="custom-landmark-marker" style="width: 24px; height: 24px;">
            <div class="marker-icon-wrapper" style="width: 20px; height: 20px; font-size: 0.65rem; background: #ef4444; border: 1.5px solid #ffffff; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white;">
              <i class="fa-solid fa-hospital"></i>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([fac.lat, fac.lng], { icon: divIcon })
        .bindPopup(`
          <div style="min-width: 180px; padding: 2px;">
            <h4 style="margin:0 0 4px 0; font-size:0.85rem; font-weight:700; color:#262626;">${fac.name}</h4>
            <p style="margin:0; font-size:0.75rem; color:#ef4444; font-weight:600;"><i class="fa-solid fa-stethoscope"></i> ${fac.type}</p>
            <p style="margin:4px 0 0 0; font-size:0.7rem; color:#8c8c8c;"><i class="fa-solid fa-location-dot"></i> ${fac.district} District</p>
          </div>
        `, { closeButton: false })
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
  }, [map, facilities]);

  return null;
}

// ----------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------
export default function App() {
  const mapRef = useRef(null);
  const districtLayerRef = useRef(null);
  const clusterGroupRef = useRef(null);

  // States
  const [districtGeoJson, setDistrictGeoJson] = useState(null);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [healthFacilities, setHealthFacilities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [hospitalsSearchQuery, setHospitalsSearchQuery] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [mouseCoords, setMouseCoords] = useState({ lat: null, lng: null });

  // Responsive states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [collapsed, setCollapsed] = useState(true);

  // Geolocation states
  const [userPosition, setUserPosition] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

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

  // Invalidate map size when sidebar collapses/expands (vital for desktop width shifts)
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 250); // Match transition duration
    }
  }, [collapsed]);

  // Fetch boundaries and coordinates on startup
  useEffect(() => {
    // Fetch locally compiled high-resolution new official districts geojson (with cache busting)
    fetch('/nepal-districts-highres.geojson?v=2')
      .then(res => res.json())
      .then(data => {
        setDistrictGeoJson(data);
        setDistrictsLoading(false);
      })
      .catch(err => {
        setDistrictsLoading(false);
        message.error("Failed to load official district boundaries.");
      });

    // Fetch hospital coordinates list (with cache busting)
    fetch('/nepal-health-facilities.json?v=2')
      .then(res => res.json())
      .then(data => setHealthFacilities(data))
      .catch(err => message.error("Failed to load hospital listings."));
  }, []);

  // Standard district styles
  function getDistrictStyle(feature) {
    const distName = resolveDistrictName(feature.properties);
    const isSelected = selectedEntity && selectedEntity.type === 'district' && selectedEntity.name.toLowerCase() === distName.toLowerCase();

    return {
      color: isSelected ? 'var(--accent)' : '#1890ff',
      weight: isSelected ? 3 : 1.5,
      opacity: 0.8,
      fillColor: '#1890ff',
      fillOpacity: isSelected ? 0.15 : 0.01
    };
  }

  function resolveDistrictName(props) {
    if (!props) return 'Unknown';
    const keys = ['DISTRICT', 'district', 'Dist_Name', 'DIST_NAME', 'name', 'NAME'];
    for (const key of keys) {
      if (props[key]) return props[key];
    }
    return 'Unknown';
  }

  // Handle District clicks
  const onEachDistrict = (feature, layer) => {
    const distName = resolveDistrictName(feature.properties);

    layer.on({
      mouseover: (e) => {
        const lyr = e.target;
        lyr.setStyle({
          color: 'var(--accent)',
          weight: 2.5,
          fillOpacity: 0.08
        });
        lyr.bringToFront();
      },
      mouseout: (e) => {
        if (districtLayerRef.current) {
          districtLayerRef.current.resetStyle(e.target);
        }
      },
      click: () => {
        selectDistrict(distName, layer);
      }
    });

    layer.bindTooltip(distName, { sticky: true, direction: 'top' });
  };

  function selectDistrict(distName, layer) {
    setSelectedEntity({
      type: 'district',
      name: distName,
      description: `${distName} is one of the 77 administrative districts in Nepal.`
    });

    if (layer && mapRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [40, 40] });
    }

    if (isMobile) {
      setCollapsed(true);
    }
  }

  function selectHealthFacility(facility) {
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
  }

  // GPS geolocation lookup
  function locateUser() {
    if (!navigator.geolocation) {
      message.error("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    message.loading({ content: "Locking GPS location...", key: 'gps-locate', duration: 0 });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setUserPosition([lat, lng]);
        setUserAccuracy(position.coords.accuracy);
        setGpsLoading(false);
        message.success({ content: "GPS Position locked!", key: 'gps-locate', duration: 2 });

        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 15);
        }

        setSelectedEntity({
          type: 'user_gps',
          lat: lat,
          lng: lng,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        setGpsLoading(false);
        message.error({ content: `GPS tracking failed: ${error.message}`, key: 'gps-locate', duration: 3 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Autocomplete search suggestions mapping
  const searchTargets = useMemo(() => {
    const list = [];
    // Add Districts
    if (districtGeoJson) {
      districtGeoJson.features.forEach(feat => {
        const dist = resolveDistrictName(feat.properties);
        if (dist && !list.some(x => x.value === dist)) {
          list.push({
            value: dist,
            type: 'district'
          });
        }
      });
    }
    // Add Health Facilities
    healthFacilities.forEach(fac => {
      list.push({
        value: fac.name,
        type: 'facility',
        meta: fac
      });
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
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{item.value}</span>
            <span style={{ fontSize: '0.7rem', color: '#8c8c8c', textTransform: 'uppercase' }}>{item.type}</span>
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
        mapRef.current.setView([item.meta.lat, item.meta.lng], 15);
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
      if (pos.lat === lat && pos.lng === lng) {
        found = layer;
      }
    });
    return found;
  }

  // Filter hospitals list in sidebar
  const filteredHospitals = useMemo(() => {
    const normalized = hospitalsSearchQuery.toLowerCase().trim();
    if (!normalized) return healthFacilities;
    return healthFacilities.filter(h => 
      h.name.toLowerCase().includes(normalized) || 
      h.district.toLowerCase().includes(normalized) || 
      h.type.toLowerCase().includes(normalized)
    );
  }, [healthFacilities, hospitalsSearchQuery]);

  return (
    <Layout>
      {/* ----------------------------------------------------
          SIDEBAR: HOSPITAL SEARCH & LIST
          ---------------------------------------------------- */}
      <Sider width={380} collapsedWidth={0} collapsible collapsed={collapsed} theme="light" trigger={null}>
        <div className="brand-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title className="brand-title" level={3} style={{ margin: 0 }}>
              <MedicineBoxOutlined style={{ color: '#ef4444' }} /> Hospital Finder
            </Title>
            <p className="brand-subtitle">Health Insurance Board (HIB) Nepal</p>
          </div>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setCollapsed(true)} 
            style={{ fontSize: '1.1rem', color: '#595959' }}
          />
        </div>

        {/* Global Autocomplete */}
        <AutoComplete
          style={{ width: '100%', marginBottom: 15 }}
          options={autocompleteOptions}
          value={searchVal}
          onSearch={onSearchChange}
          onSelect={onSearchSelect}
          placeholder="Search districts or hospitals..."
          allowClear
        />

        {/* Selected Profile Details Card */}
        {selectedEntity && (
          <div style={{ marginBottom: 15 }}>
            {selectedEntity.type === 'district' && (
              <Card size="small" title={<span><GlobalOutlined /> District Boundary</span>} style={{ borderColor: '#d9d9d9' }}>
                <Title level={5} style={{ margin: 0 }}>{selectedEntity.name}</Title>
                <Paragraph style={{ color: '#595959', fontSize: '0.8rem', margin: '8px 0 0 0' }}>
                  {selectedEntity.description}
                </Paragraph>
              </Card>
            )}

            {selectedEntity.type === 'health_facility' && (
              <Card 
                size="small" 
                title={<span style={{ color: '#ef4444' }}><MedicineBoxOutlined /> Health Facility Profile</span>} 
                style={{ borderColor: '#ef4444' }}
              >
                <Title level={5} style={{ margin: 0 }}>{selectedEntity.name}</Title>
                <div style={{ marginTop: 8 }}>
                  <div className="detail-row">
                    <span className="detail-label">Type</span>
                    <span className="detail-value" style={{ color: '#ef4444' }}>{selectedEntity.facilityType}</span>
                  </div>
                  <div className="detail-row">
                    <span class="detail-label">District</span>
                    <span className="detail-value">{selectedEntity.district}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Coordinates</span>
                    <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {selectedEntity.coords[0].toFixed(5)}, {selectedEntity.coords[1].toFixed(5)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button 
                    type="primary" 
                    danger 
                    size="small" 
                    icon={<FullscreenOutlined />}
                    onClick={() => mapRef.current?.setView(selectedEntity.coords, 16)}
                    style={{ flex: 1 }}
                  >
                    Zoom to Map
                  </Button>
                  <Button 
                    size="small"
                    onClick={() => {
                      setSelectedEntity(null);
                      mapRef.current?.setView(NEPAL_CENTER, 7.3);
                    }}
                    style={{ flex: 1 }}
                  >
                    Clear Focus
                  </Button>
                </div>
              </Card>
            )}

            {selectedEntity.type === 'user_gps' && (
              <Card size="small" title={<span><AimOutlined style={{ color: '#1890ff' }} /> GPS Position</span>}>
                <div className="detail-row">
                  <span className="detail-label">Lat / Lng</span>
                  <span className="detail-value" style={{ fontFamily: 'monospace' }}>
                    {selectedEntity.lat.toFixed(5)}, {selectedEntity.lng.toFixed(5)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Accuracy</span>
                  <span className="detail-value">~{selectedEntity.accuracy.toFixed(1)} meters</span>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* scrollable Hospitals List */}
        <div className="hospitals-list-wrapper">
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>
            Registered Hospitals ({filteredHospitals.length})
          </Text>
          <Input
            style={{ marginBottom: 12 }}
            placeholder="Filter list by name or district..."
            value={hospitalsSearchQuery}
            onChange={(e) => setHospitalsSearchQuery(e.target.value)}
            allowClear
          />
          <div className="hospitals-scroll-list">
            {filteredHospitals.map((facility) => {
              const isSelected = selectedEntity && selectedEntity.type === 'health_facility' && selectedEntity.name === facility.name;
              return (
                <div 
                  key={facility.name}
                  className={`hospital-item-card ${isSelected ? 'selected' : ''}`}
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
                  <div className="hospital-item-name">{facility.name}</div>
                  <div className="hospital-item-meta">
                    <span><EnvironmentOutlined /> {facility.type} | {facility.district}</span>
                    <span className="hospital-item-coords">{facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Sider>

      {/* ----------------------------------------------------
          RIGHT SIDE: STANDARD LEAFLET MAP
          ---------------------------------------------------- */}
      <Content>
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
            <Text strong style={{ color: '#1890ff' }}>Loading New official pointed boundaries of Nepal...</Text>
          </div>
        )}
        {collapsed && (
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(false)}
          >
            <MenuOutlined />
          </button>
        )}
        <MapContainer
          center={NEPAL_CENTER}
          zoom={7.3}
          minZoom={6}
          maxZoom={16}
          maxBounds={NEPAL_BOUNDS}
          maxBoundsViscosity={0.8}
          zoomControl={false}
          renderer={L.canvas()}
        >
          {/* CartoDB Voyager Light Basemap */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors'
          />

          <ScaleControl position="bottomright" imperial={false} />

          <MapController
            mapRef={mapRef}
            setMouseCoords={setMouseCoords}
            districtLayerRef={districtLayerRef}
          />

          {/* District boundaries GeoJSON layer */}
          {districtGeoJson && (
            <GeoJSON
              data={districtGeoJson}
              style={getDistrictStyle}
              onEachFeature={onEachDistrict}
              ref={districtLayerRef}
              key={`districts-${selectedEntity?.name || 'none'}`}
            />
          )}

          {/* Clustered hospital pins */}
          <HealthFacilitiesClusterLayer
            facilities={healthFacilities}
            onSelect={selectHealthFacility}
            clusterGroupRef={clusterGroupRef}
          />

          {/* GPS Location marker */}
          {userPosition && (
            <>
              <Marker
                position={userPosition}
                icon={L.divIcon({
                  className: 'gps-user-marker-container',
                  html: `
                    <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
                      <div style="position:absolute; width:16px; height:16px; border-radius:50%; background:#1890ff; border:2px solid #ffffff; box-shadow:0 0 8px rgba(0,0,0,0.3); z-index:2;"></div>
                    </div>
                  `,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11]
                })}
              >
                <Popup closeButton={false}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Your Location</div>
                </Popup>
              </Marker>
              
              {userAccuracy && (
                <Circle
                  center={userPosition}
                  radius={userAccuracy}
                  pathOptions={{
                    color: '#1890ff',
                    fillColor: '#1890ff',
                    fillOpacity: 0.08,
                    weight: 1.5,
                    dashArray: '4, 4'
                  }}
                />
              )}
            </>
          )}
        </MapContainer>

        {/* Floating actions HUD */}
        <div className="map-floating-bar">
          <Tooltip title="Zoom to my position (GPS)" placement="left">
            <button 
              className={`floating-bar-btn ${gpsLoading ? 'active' : ''}`}
              onClick={locateUser}
              disabled={gpsLoading}
            >
              {gpsLoading ? <Spin size="small" /> : <AimOutlined />}
            </button>
          </Tooltip>
          
          <Tooltip title="Fit Nepal Bounds" placement="left">
            <button 
              className="floating-bar-btn"
              onClick={() => {
                setSelectedEntity(null);
                mapRef.current?.setView(NEPAL_CENTER, 7.3);
              }}
            >
              <CompassOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Real-time coordinates HUD display */}
        <div id="coordinates-display">
          <EnvironmentOutlined style={{ marginRight: 4 }} />
          Lat: <span>{mouseCoords.lat ? mouseCoords.lat.toFixed(5) : '--'}</span> | Lng: <span>{mouseCoords.lng ? mouseCoords.lng.toFixed(5) : '--'}</span>
        </div>
      </Content>
    </Layout>
  );
}
