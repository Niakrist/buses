const fetchBusData = async () => {
  try {
    const response = await fetch("/next-departure");
    if (!response.ok) {
      throw new Error(
        `Не удалось получить данные HTTP_ERROR! STATUS: ${response.status}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching bus data: ${error}`);
  }
};

const renderhBusData = async (data) => {
  const bus = document.getElementById("bus");
  const busTBody = bus.querySelector("tbody");
  busTBody.textContent = "";

  const formatDate = (date) => date.toISOString().split("T")[0];
  const formatTime = (time) => time.toTimeString().split(" ")[0].slice(0, 5);

  const buses = await data.map((bus) => {
    const nextDepartureDateTimeUTC = new Date(
      `${bus.nextDeparture.date}T${bus.nextDeparture.time}Z`
    );

    const tr = document.createElement("tr");

    const busNumber = document.createElement("td");
    busNumber.textContent = bus.busNumber;

    const route = document.createElement("td");
    route.textContent = `${bus.startPoint} -> ${bus.endPoint}`;

    const nextDepartureDate = document.createElement("td");
    nextDepartureDate.textContent = formatDate(nextDepartureDateTimeUTC);

    const nextDepartureTime = document.createElement("td");
    nextDepartureTime.textContent = formatTime(nextDepartureDateTimeUTC);

    const frequencyMinutes = document.createElement("td");
    frequencyMinutes.textContent = bus.frequencyMinutes;

    tr.append(
      busNumber,
      route,
      nextDepartureDate,
      nextDepartureTime,
      frequencyMinutes
    );

    return tr;
  });

  busTBody.append(...buses);
};

const getCurrentTime = () => {
  const getTime = () => {
    const date = new Date();

    const addZero = (data) => {
      return data < 10 ? `0${data}` : data;
    };

    return `${addZero(date.getHours())}:${addZero(date.getMinutes())}:${addZero(
      date.getSeconds()
    )}`;
  };

  const timeElem = document.querySelector(".current_time");

  if (!timeElem.textContent) {
    timeElem.textContent = getTime();
  }

  setInterval(() => {
    timeElem.textContent = getTime();
  }, 1000);
};

const init = async () => {
  const data = await fetchBusData();
  renderhBusData(data);
  getCurrentTime();
};

init();
