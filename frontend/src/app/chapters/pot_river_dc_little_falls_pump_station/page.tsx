"use client";

import { useEffect } from "react";
export default function LittleFallsPumpStation() {
    // call the api endpoint to return the contirnousu information about the flood threshold for the Little Falls Pump Station

    // call the async method with a useEffect hook to fetch the data when the component mounts
    useEffect(() => {
        fetchContinuousData();
    }, []);


    const fetchContinuousData = async () => {
        try {
            const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/potomac/little_falls_pump_station/current_conditions');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            console.log('Continuous Data:', data);
        } catch (error) {
            console.error('Error fetching continuous data:', error);
        }
    };

    return (
        <div>
            <h1>Little Falls Pump Station</h1>
            <p>This is the Little Falls Pump Station page.</p>
        </div>
    );
}