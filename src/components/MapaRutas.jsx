import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useJsApiLoader
} from '@react-google-maps/api';
import { useEffect, useState } from 'react';
import Papa from 'papaparse';

const containerStyle = {
  width: '100%',
  height: '600px'
};

const center = {
  lat: -27.4712,
  lng: -58.8367
};

export function MapaRutas() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: 'AIzaSyCQ5AidfjBOg7VI2sgkbpnKHPBGAoLQ15w',
    libraries: ['places']
  });

  const [puntos, setPuntos] = useState(() => {
    const saved = localStorage.getItem('rutas_puntos');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 1, nombre: 'Cliente 1', direccion: 'Junin 1224, Corrientes', activo: true },
          { id: 2, nombre: 'Cliente 2', direccion: 'Salta 877, Corrientes', activo: true },
          { id: 3, nombre: 'Cliente 3', direccion: 'España 1500, Corrientes', activo: true }
        ];
  });

  const [entregados, setEntregados] = useState(() => {
    const saved = localStorage.getItem('rutas_entregados');
    return saved ? JSON.parse(saved) : [];
  });

  const [directions, setDirections] = useState(null);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [ordenOptimizado, setOrdenOptimizado] = useState([]);
  const [resumenRuta, setResumenRuta] = useState({ distancia: '', duracion: '' });
  const [ubicaciones, setUbicaciones] = useState([]);

  // Guardar en localStorage
  useEffect(() => {
    localStorage.setItem('rutas_puntos', JSON.stringify(puntos));
  }, [puntos]);

  useEffect(() => {
    localStorage.setItem('rutas_entregados', JSON.stringify(entregados));
  }, [entregados]);

  useEffect(() => {
    if (!isLoaded) return;

    const geocoder = new window.google.maps.Geocoder();
    const activos = puntos.filter(p => p.activo);
    if (activos.length < 2) return;

    Promise.all(
      activos.map(p =>
        new Promise((resolve, reject) => {
          geocoder.geocode({ address: p.direccion }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve({
                ...p,
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              });
            } else {
              console.warn(`Error geocodificando ${p.direccion}: ${status}`);
              reject();
            }
          });
        })
      )
    ).then(result => {
      setUbicaciones(result); // guardar ubicaciones para marcadores

      const origin = result[0];
      const destination = result[result.length - 1];
      const waypoints = result.slice(1, -1).map(p => ({
        location: { lat: p.lat, lng: p.lng },
        stopover: true
      }));

      const service = new window.google.maps.DirectionsService();
      service.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (resultDirections, status) => {
          if (status === 'OK') {
            setDirections(resultDirections);

            const total = resultDirections.routes[0].legs.reduce(
              (acc, leg) => {
                acc.distancia += leg.distance.value;
                acc.duracion += leg.duration.value;
                return acc;
              },
              { distancia: 0, duracion: 0 }
            );
            setResumenRuta({
              distancia: (total.distancia / 1000).toFixed(2) + ' km',
              duracion: Math.round(total.duracion / 60) + ' min'
            });

            const orden = resultDirections.routes[0].waypoint_order;
            const ordenFinal = [
              activos[0],
              ...orden.map(i => activos[i + 1]),
              activos[activos.length - 1]
            ];
            setOrdenOptimizado(ordenFinal);
          } else {
            console.error('Error al calcular ruta:', status);
          }
        }
      );
    });
  }, [puntos, isLoaded]);

  const togglePunto = id => {
    setPuntos(puntos.map(p => (p.id === id ? { ...p, activo: !p.activo } : p)));
  };

  const agregarDireccion = () => {
    if (!nuevaDireccion.trim()) return;
    setPuntos([
      ...puntos,
      {
        id: Date.now(),
        nombre: `Nuevo`,
        direccion: nuevaDireccion.includes('Corrientes')
          ? nuevaDireccion
          : `${nuevaDireccion}, Corrientes`,
        activo: true
      }
    ]);
    setNuevaDireccion('');
  };

  const marcarComoEntregado = id => {
    setEntregados(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const nuevosPuntos = results.data.map((row, index) => ({
          id: Date.now() + index,
          nombre: row.nombre || `Cliente ${index + 1}`,
          direccion: row.direccion?.includes('Corrientes')
            ? row.direccion
            : `${row.direccion}, Corrientes`,
          activo: true
        }));
        setPuntos(prev => [...prev, ...nuevosPuntos]);
      }
    });
  };

  if (!isLoaded) return <div>Cargando mapa...</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h3>📍 Puntos de Entrega</h3>
        {puntos.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <input
              type="checkbox"
              checked={p.activo}
              onChange={() => togglePunto(p.id)}
            />
            <span
              style={{
                marginLeft: 8,
                textDecoration: entregados.includes(p.id) ? 'line-through' : 'none',
                color: entregados.includes(p.id) ? 'gray' : 'white',
                flex: 1
              }}
            >
              {p.nombre} - {p.direccion}
            </span>
            <button onClick={() => marcarComoEntregado(p.id)} style={{ marginLeft: 10 }}>
              {entregados.includes(p.id) ? '✅' : 'Entregado'}
            </button>
          </div>
        ))}

        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={nuevaDireccion}
            placeholder="Ej: Av. 3 de Abril 900, Corrientes"
            onChange={e => setNuevaDireccion(e.target.value)}
            style={{ padding: '5px', width: '300px' }}
          />
          <button onClick={agregarDireccion} style={{ marginLeft: 10 }}>
            ➕ Agregar Dirección
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input type="file" accept=".csv" onChange={handleFileUpload} />
          <small style={{ display: 'block', marginTop: 5 }}>
            📎 Subí un archivo CSV con columnas <strong>nombre</strong> y <strong>direccion</strong>
          </small>
        </div>

        
      </div>

      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={14}>
        {ubicaciones.map(p => (
          <Marker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            label={p.nombre}
            icon={{
              url: entregados.includes(p.id)
                ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
            }}
          />
        ))}
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>

      {ordenOptimizado.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>📦 Orden de Entregas Optimizado</h3>
          <ol>
            {ordenOptimizado.map(p => (
              <li key={p.id}>
                {entregados.includes(p.id) ? '✅ ' : ''}
                {p.nombre} - {p.direccion}
              </li>
            ))}
          </ol>
          <p>🛣️ Distancia total: <strong>{resumenRuta.distancia}</strong></p>
          <p>⏱️ Tiempo estimado: <strong>{resumenRuta.duracion}</strong></p>
        </div>
      )}
    </div>
  );
}
