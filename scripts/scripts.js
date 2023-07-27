'use strict';

const form = document.querySelector('.form__to-do');
const containerTasks = document.querySelector('.tasks');
const inputTask = document.querySelector('.form__input--task');
const inputDuration = document.querySelector('.form__input--duration');
const inputDeadline = document.querySelector('.form__input--time');

class Task {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, duration, deadline, description) {
    this.coords = coords; // [LATITUDE, LONGITUDE]
    this.duration = duration; // MINUTES
    this.deadline = deadline; // TIME
    this._setDescription(description);
  }

  _setDescription(description) {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this._setDescription = `${description.toUpperCase()} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class MaptyDo {
  #map;
  #mapZoom = 15;
  #mapEvent;
  #tasks = [];
  #markers = [];

  constructor() {
    // IF EXISTS, FETCH TASK FROM LOCAL STORAGE
    this._getLocalStorage();
    // GET THE USERS CURRENT LOCATION
    this._getPosition();
    // FORM SUBMIT EVENT LISTENER
    form.addEventListener('submit', this._newTask.bind(this));
    // TASK CLICK EVENT LISTENER (BRING TASK INTO VIEW)
    containerTasks.addEventListener('click', this._moveToPopup.bind(this));

    $(document).on(
      'click',
      '.task__complete-btn',
      this._completeTask.bind(this)
    );
  }

  _getPosition() {
    if (navigator.geolocation) {
      // GET CURRENT COORDINATES FOR THE USER AND RENDER MAP THE MAP
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          console.log(
            "Couldn't get your location. Please enable the required permissions. "
          );
        }
      );
    }
  }

  _loadMap(position) {
    // GET USER COORDINATES FROM CURRENT LOCATION DATA
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    // SET MAP TO CURRENT COORDINATES
    this.#map = L.map('map').setView(coords, this.#mapZoom);

    L.tileLayer(
      'https://api.mapbox.com/styles/v1/captainmidway/ckcxaflwj0olg1imua3ot67dw/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiY2FwdGFpbm1pZHdheSIsImEiOiJja2N4YTBmNmMwNGVmMnpwcDl0d2ZrdTZvIn0.eCTzdhwPIm2WejMEWGsKBA',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(this.#map);

    // HANDLING MAP CLICKS
    this.#map.on('click', this._showForm.bind(this));

    this.#tasks.forEach(task => {
      this._renderTaskMarker(task);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputTask.focus();
  }

  _hideForm() {
    inputTask.value = inputDuration.value = inputDeadline.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _newTask(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // GET DATA FROM THE FORM
    let task;
    const description = inputTask.value;
    const duration = +inputDuration.value;
    const deadline = inputDeadline.value;
    const { lat, lng } = this.#mapEvent.latlng;

    // CHECK VALIDITY OF DATA
    if (!validInputs(duration) || !allPositive(duration))
      return alert('Duration must be a positive number.');

    // CREATE TASK OBJECT
    task = new Task([lat, lng], duration, deadline, description);

    // ADD NEW TASK TO TASKS ARRAY
    this.#tasks.push(task);

    // RENDER TASK ON MAP AS MARKER
    this._renderTaskMarker(task);

    // RENDER TASK ON LIST
    this._renderTask(task);

    // HIDE FORM & CLEAR INPUT FIELDS
    this._hideForm();

    // SET LOCAL STORAGE TO ALL TASKS
    this._setLocalStorage();
  }

  _renderTaskMarker(task) {
    var pin = L.icon({
      iconUrl: './images/map-pin.png',
      shadowUrl: './images/pin-shadow.png',

      iconSize: [25, 25], // size of the icon
      shadowSize: [0, 0], // size of the shadow
      iconAnchor: null, // point of the icon which will correspond to marker's location
      shadowAnchor: [4, 62], // the same for the shadow
      popupAnchor: [0, 0], // point from which the popup should open relative to the iconAnchor
    });

    let marker = L.marker(task.coords, { icon: pin })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          autoPan: true,
          keepInView: true,
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: ``,
        })
      )
      .setPopupContent(`${task._setDescription}`)
      .openPopup();

    this.#markers.push([task.id, marker]);
  }

  _renderTask(task) {
    let html = `
    <li class="task" data-id="${task.id}">
      <div class="task__information">
        <h2 class="task__title">${task._setDescription}</h2>
        <div class="task__specifics">
          <div class="task__details">
            <span class="task__icon">⏱️</span>
            <span class="task__value">${task.duration}</span>
            <span class="task__unit">min</span>
          </div>
          <div class="task__details">
            <span class="task__icon">📆</span>
            <span class="task__value">${task.deadline}</span>
            <span class="task__unit">hours</span>
          </div>
        </div>
        <div class="task__details">
          <button class="task__complete-btn">COMPLETE</button>
        </div>
      </div>
      <div class="task__weather">
        <img class="weather__icon-${task.id}" style="max-width: fit-content;" src="" />
        <p class="weather__description description-${task.id}"></p>
      </div>
    </li>`;
    form.insertAdjacentHTML('afterend', html);
    this._fetchWeatherInformation(task.id, task.coords);
  }

  async _fetchWeatherInformation(id, coords) {
    const API_KEY = `4736594bab76e2b6b76b9af1120419e8`;
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${
      coords[0]
    }&lon=${coords[1]}&limit=${`1`}&appid=${API_KEY}`;

    return fetch(url)
      .then(response => response.json())
      .then(async data => {
        const weatherURL = `https://api.openweathermap.org/data/2.5/weather?q=${data[0].name}&units=metric&appid=${API_KEY}`;

        const response = await fetch(weatherURL);
        const data_2 = await response.json();
        const weatherData = {
          temperature: data_2.main.temp,
          condition: data_2.weather[0].main,
          condIcon: data_2.weather[0].icon,
        };
        return weatherData;
      })
      .then(weatherData => {
        document
          .querySelector(`.weather__icon-${id}`)
          .setAttribute(
            'src',
            `https://openweathermap.org/img/wn/${weatherData.condIcon}.png`
          );
        document.querySelector(
          `.description-${id}`
        ).innerHTML = `${weatherData.condition}, ${weatherData.temperature}°C`;
      });
  }

  _moveToPopup(e) {
    const taskEl = e.target.closest('.task');
    if (!taskEl) return;

    const task = this.#tasks.find(task => task.id === taskEl.dataset.id);

    this.#map.setView(task.coords, this.#mapZoom, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    this._setLocalStorage();
  }

  _setLocalStorage() {
    localStorage.setItem('tasks', JSON.stringify(this.#tasks));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('tasks'));

    if (!data) return;

    this.#tasks = data;
    this.#tasks.forEach(task => {
      this._renderTask(task);
    });
  }

  reset() {
    localStorage.removeItem('tasks');
    location.reload();
  }

  _completeTask(e) {
    e.stopPropagation();

    const taskEl = e.target.closest('.task');
    if (!taskEl) return;

    const index = this.#tasks.indexOf(task => task.id === taskEl.dataset.id);
    this.#tasks.splice(index, 1);
    this._setLocalStorage();

    taskEl.remove();

    let [_, marker] = this.#markers.find(arr => arr[0] === taskEl.dataset.id);
    this.#map.removeLayer(marker);
  }
}

// http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit={limit}&appid={API key}

const app = new MaptyDo();
