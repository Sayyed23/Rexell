"use client";

require("dotenv").config();
import { useAccount, useWriteContract } from "wagmi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/shared/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/header";
import {
  rexellAbi,
  contractAddress,
} from "@/blockchain/abi/rexell-abi";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { processCheckout } from "@/lib/TokenFuction";

export default function CreateEventPage() {
  const [file, setFile] = useState(null);
  const [cid, setCid] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputFile = useRef(null);
  const [minDate, setMinDate] = useState("");
  const [timeError, setTimeError] = useState(false);
  const { address, isConnected } = useAccount();
  const { isPending, error, writeContractAsync } = useWriteContract();
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [ invalid, setInvalid]= useState(false);

  const uploadFile = async (fileToUpload: any) => {
    try {
      setUploading(true);
      const data = new FormData();
      data.set("file", fileToUpload);
      const res = await fetch("/api/files", {
        method: "POST",
        body: data,
      });
      const resData = await res.json();
      setCid(resData.IpfsHash);
      console.log(resData.IpfsHash);
      setUploading(false);
    } catch (e: any) {
      console.log(e);
      setUploading(false);
      alert("Trouble uploading file");
    }
  };

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setMinDate(`${year}-${month}-${day}`);
  }, []);

  const handleChange = (e: any) => {
    const selectedFile = e.target.files[0];

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/png", "image/gif"]; // Allowed file types
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (!validTypes.includes(selectedFile.type)) {
      setInvalid(true);
      toast.error("Only JPG, PNG, and GIF files are allowed.");
      return; // Prevent further execution if the file type is invalid
    }

    if (selectedFile.size > maxSize) {
      setInvalid(true);
      toast.error("File size must be less than 5 MB.");
      return; // Prevent further execution if the file size exceeds the limit
    }

    setFile(selectedFile); // Only set the file if it's valid
    uploadFile(selectedFile); // Proceed with the upload
    setInvalid(false);
    console.log(invalid);
  };

  const handleCategoryChange = (event: any) => {
    setCategory(event.target.value); // Update the state with the selected value
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
   
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    console.log(data);

    const selectedDate = new Date(`${data.date}T${data.time}`);
    const currentDate = new Date();
    console.log(`${selectedDate}, ${currentDate}`)

    if (selectedDate < currentDate) {
      setTimeError(true);
      toast.error("Please select a future date and time.");
      return;
    }
    setTimeError(false);
    
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    if (invalid) {
      toast.error("Please upload JPG,PNG and GIF");
      return;
    }   
    try {
      const dateObject = new Date(data.date as string);
      const dateInMilliseconds = dateObject.getTime();

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: rexellAbi,
        functionName: "createEvent",
        args: [
          data.name as string,
          data.venue as string,
          category,
          BigInt(dateInMilliseconds),
          data.time as string,
          BigInt(Number(data.price) * 10 ** 18),
          cid as string,
          BigInt(data.tickets as string),
          data.description as string,
        ],
      });
      if (hash) {
        console.log(hash);
        toast("Event has been created", {
          description: `${data.date} at ${data.time}`,
        });
        router.push("/events");
      } else {
        toast("Something happened, try again.");
      }
    } catch (e) {
      console.log(e);
      toast.error("Failed to create event, try again.");
      return;
    }
  }

  return (
    <main className="flex flex-col ">
      <div className="hidden sm:block">
        <Header />
      </div>
      <section className="selection: border-rounded-md mx-auto max-w-md space-y-6 px-6 py-8 shadow-lg shadow-gray-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Create Event</h1>
          <p className="text-gray-500 ">
            Fill out the details to create a new event.
          </p>
        </div>

        <form onSubmit={submit} className="">
          <div className="width-fit mb-2 grid max-w-sm items-center gap-1.5">
            <Label htmlFor="poster">Poster</Label>
            <p className="text-sm text-gray-400">
              (Upload poster for your event)
            </p>
            <Input
              id="poster"
              type="file"
              ref={inputFile}
              onChange={handleChange}
              className="w-fit text-gray-500"
              required
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Event Name</Label>
              <Input id="name" name="name" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" name="venue" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select>
                <SelectTrigger
                  className="w-[180px]"
                  name="category"
                  id="category"
                  onChange={(event) =>
                    setCategory((event.target as HTMLInputElement).value as string)
                  }
                 
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Select category</SelectLabel>
                    <SelectItem value="Education & Learning">
                      Education & Learning
                    </SelectItem>
                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                    <SelectItem value="Travel & Outdoor">
                      Travel & Outdoor
                    </SelectItem>
                    <SelectItem value="Movies & Film">Movies & Film</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" min={minDate} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input id="time" name="time" type="time"  required />
              {timeError && <p className="text-red-500">Select a valid future time.</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price">Price (cUSD)</Label>
              <Input id="price" name="price" type="number" min={0} step={0.01} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tickets">Number of Tickets</Label>
              <Input id="tickets" name="tickets" type="number" min={1} step={1} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Event Description</Label>
              <Textarea id="description" name="description" required />
            </div>
          </div>

          <Button disabled={isPending} className="mt-8 w-full" type="submit">
            {isPending ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </section>
    </main>
  );
}
