import express from "express";
import { readFile } from "node:fs/promises";
import path from "path";
import { DateTime } from "luxon";

const __dirname = import.meta.dirname;

const PORT = 5000;
const TIME_ZONE = "UTC+3";

const app = express();

const loadBuses = async () => {
  const data = await readFile(path.resolve(__dirname, "buses.json"), "utf-8");
  return JSON.parse(data);
};

const getNextDeparture = (firstDepartureTime, frequencyMinutes) => {
  const now = DateTime.now().setZone(TIME_ZONE);
  const [hours, minutes] = firstDepartureTime.split(":").map(Number);
  let departure = DateTime.now().set({ hours, minutes }).setZone(TIME_ZONE);

  if (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });
  }

  const endOfDay = DateTime.now()
    .set({ hours: 23, minute: 59 })
    .setZone(TIME_ZONE);

  if (departure > endOfDay) {
    departure = departure
      .startOf("day")
      .plus({ days: 1 })
      .set({ hours, minutes });
  }

  while (now > departure) {
    departure = departure.plus({ minutes: frequencyMinutes });

    if (departure > endOfDay) {
      departure = departure
        .startOf("day")
        .plus({ days: 1 })
        .set({ hours, minutes });
    }
  }

  return departure;
};

const sendUpdateData = async () => {
  const bases = await loadBuses();

  const updateBuses = bases.map((bus) => {
    const nextDeparture = getNextDeparture(
      bus.firstDepartureTime,
      bus.frequencyMinutes
    );
    return {
      ...bus,
      nextDeparture: {
        date: nextDeparture.toFormat("yyyy-MM-dd"),
        time: nextDeparture.toFormat("HH:mm:ss"),
      },
    };
  });

  return updateBuses;
};

app.get("/next-departure", async (req, res) => {
  try {
    const updateBuses = await sendUpdateData();

    const sortedTimeBuses = updateBuses.sort((a, b) => {
      return a.nextDeparture.time.localeCompare(b.nextDeparture.time);
    });

    const sortedDateBuses = sortedTimeBuses.sort((a, b) => {
      return a.nextDeparture.date.localeCompare(b.nextDeparture.date);
    });

    return res.json(sortedDateBuses);
  } catch (error) {
    return res.json({ error: "Error" });
  }
});

app.listen(PORT, () => console.log(`Server started on PORT ${PORT}`));
