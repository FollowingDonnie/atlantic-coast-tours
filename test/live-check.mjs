import { checkWeather } from "../src/tools/weather.mjs";
import { searchTours } from "../src/tools/tours.mjs";

const tours = await searchTours({
  query: "Sea Cave Kayaking at Kilkee",
  tour_name: "Sea Cave Kayaking at Kilkee",
  category: "Kayak Trip",
  location: "Kilkee",
  max_price_eur: null,
  availability: "any",
  offers_only: false
});

if (tours.tours[0]?.tour_id !== "ACT012") {
  throw new Error("The live Sheet lookup did not return ACT012.");
}
if (tours.tours[0]?.slots_this_week !== 0) {
  throw new Error("The live zero-slot value was not preserved.");
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const weather = await checkWeather({
  location: "Kilkee, Co. Clare",
  date: tomorrow
});
if (!weather.source || weather.source.name !== "Open-Meteo") {
  throw new Error("The live Open-Meteo lookup did not return source metadata.");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sheet: {
        fetchedAt: tours.fetchedAt,
        rowCount: tours.sheetRowCount,
        matchedTour: tours.tours[0].tour_name,
        slotsThisWeek: tours.tours[0].slots_this_week
      },
      weather: {
        fetchedAt: weather.fetchedAt,
        location: weather.location.name,
        date: weather.date,
        available: weather.available
      }
    },
    null,
    2
  )
);

