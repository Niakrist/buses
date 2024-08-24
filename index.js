import express from "express";
import { readFile } from "node:fs/promises";
import path from "path";
import { DateTime, Duration } from "luxon";

import { WebSocketServer } from "ws";

const __dirname = import.meta.dirname;
const PORT = 5000;
const TIME_ZONE = "UTC";

const app = express();

app.use(express.static(path.resolve(__dirname, "public")));

const loadBuses = async () => {
  const data = await readFile(path.resolve(__dirname, "buses.json"), "utf-8");
  return JSON.parse(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
  const now = DateTime.now().setZone(TIME_ZONE);

  const [hour, minute] = firstDepartureTime.split(":").map(Number);

  let departure = DateTime.now()
    .set({ hour, minute, second: 0, millisecond: 0 })
    .setZone(TIME_ZONE);

  if (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });
  }

  const endOfDay = DateTime.now()
    .set({ hour: 23, minute: 59, second: 59 })
    .setZone(TIME_ZONE);

  if (departure > endOfDay) {
    departure = departure
      .startOf("day")
      .plus({ days: 1 })
      .set({ hour, minute });
  }

  while (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });

    if (departure > endOfDay) {
      departure = departure
        .startOf("day")
        .plus({ days: 1 })
        .set({ hour, minute });
    }
  }

  return departure;
};

const sendUpdateData = async () => {
  const bases = await loadBuses();

  const now = DateTime.now().setZone(TIME_ZONE);

  const updateBuses = bases.map((bus) => {
    const nextDeparture = getNextDeparture(
      bus.firstDepartureTime,
      bus.frequencyMinutes
    );

    const timeRemaining = Duration.fromMillis(
      nextDeparture.diff(now).toMillis()
    );

    return {
      ...bus,
      nextDeparture: {
        date: nextDeparture.toFormat("yyyy-MM-dd"),
        time: nextDeparture.toFormat("HH:mm:ss"),
        remaining: timeRemaining.toFormat("hh:mm:ss"),
      },
    };
  });

  return updateBuses;
};

app.get("/next-departure", async (req, res) => {
  try {
    const updateBuses = await sendUpdateData();

    // Сортировка по времени
    const sortedTimeBuses = updateBuses.sort((a, b) => {
      return a.nextDeparture.time.localeCompare(b.nextDeparture.time);
    });

    // Сортировка по дате
    const sortedDateBuses = sortedTimeBuses.sort((a, b) => {
      return a.nextDeparture.date.localeCompare(b.nextDeparture.date);
    });

    return res.json(sortedDateBuses);
  } catch (error) {
    return res.json({ error: "Error" });
  }
});

const wss = new WebSocketServer({
  noServer: true,
});

const clients = new Set();

wss.on("connection", (ws) => {
  console.log("WebSoket connection back");
  clients.add(ws);

  const sendUpdates = async () => {
    try {
      const updateBuses = await sendUpdateData();
      const sortedTimeBuses = updateBuses.sort((a, b) => {
        return a.nextDeparture.time.localeCompare(b.nextDeparture.time);
      });

      // Сортировка по дате
      const sortedDateBuses = sortedTimeBuses.sort((a, b) => {
        return a.nextDeparture.date.localeCompare(b.nextDeparture.date);
      });

      ws.send(JSON.stringify(sortedDateBuses));
    } catch (error) {
      console.error(`Error websoket connetion ${error}`);
    }
  };

  const intervalId = setInterval(sendUpdates, 1000);

  ws.on("close", () => {
    console.log("WebSoket close");
    clearInterval(intervalId);
    clients.delete(ws);
  });
});

const server = app.listen(PORT, () =>
  console.log(`Server started on PORT ${PORT}`)
);

server.on("upgrade", (req, soket, head) => {
  wss.handleUpgrade(req, soket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
